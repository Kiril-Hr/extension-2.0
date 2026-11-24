const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const { once, on } = require('node:events')
const { spawn, execFileSync } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')

const consumer = path.resolve(process.argv[2])
const installed = createRequire(path.join(consumer, 'package.json'))
const webpack = installed('webpack')
const root = fs.mkdtempSync(path.join(consumer, 'background-entry-'))
const folder = 'src/extensionOptions/backgrounds/'
const entry = folder + 'index.ts'
const service = folder + 'services/label.ts'
const contract = 'src/messaging/contract.ts'
const handler = folder + 'handlers.ts'
const legacy = folder + 'legacy.js'
const read = file => fs.readFileSync(file, 'utf8')
const write = (file, text) => fs.writeFileSync(file, text)
const config = mode => installed('devxtension/dist/config/webpack.' + mode)
const until = async (test, label) => {
  const end = Date.now() + 45000
  while (!test()) {
    if (Date.now() >= end) throw Error('Timed out: ' + label)
    await delay(50)
  }
}

async function build() {
  const compiler = webpack(config('prod'))
  try {
    return await new Promise((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats)))
  } finally {
    await new Promise(resolve => compiler.close(resolve))
  }
}

function resources(stats, name) {
  const c = stats.compilation
  const files = new Set()
  function visit(mod) {
    if (mod.resource) files.add(mod.resource.replaceAll('\\', '/'))
    if (mod.modules) for (const child of mod.modules) visit(child)
  }
  for (const mod of c.chunkGraph.getChunkModulesIterable(c.namedChunks.get(name))) visit(mod)
  return [...files]
}

async function production(origin, expectedLegacy) {
  const stats = await build()
  assert(!stats.hasErrors(), stats.toString('errors-only'))
  const content = resources(stats, 'runner')
  const worker = resources(stats, 'background')
  assert(content.some(f => f.endsWith('/runner.ts')) && !content.some(f => f.endsWith('/services/label.ts')))
  assert(worker.some(f => f.endsWith('/services/label.ts')) && !worker.some(f => /\/runner\.ts$|\/react(-dom)?\//.test(f)))
  for (const graph of [content, worker]) assert(graph.some(f => f.endsWith('/messaging/contract.ts')))
  const manifest = JSON.parse(read('dist/manifest.json'))
  assert.deepEqual(manifest.background, { service_worker: 'background.js' })
  assert.deepEqual(manifest.permissions || [], [])
  assert.deepEqual(manifest.host_permissions || [], [])

  const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH)
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium',
    executablePath: process.env.DEVEX_CHROMIUM_PATH, chromiumSandbox: true,
    ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] })
  try {
    const page = await ctx.newPage()
    page.on('pageerror', e => console.error('Page error:', e.message))
    const session = await ctx.browser().newBrowserCDPSession()
    const lifecycle = await ctx.newCDPSession(page)
    const updates = on(lifecycle, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(45000) })
    const onRegistration = on(lifecycle, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(45000) })
    try {
      await lifecycle.send('ServiceWorker.enable')
      const { id } = await session.send('Extensions.loadUnpacked', { path: path.resolve('dist') })
      async function probe() {
        await page.goto(origin)
        await page.waitForFunction(() => document.documentElement.dataset.answer && document.documentElement.dataset.legacy)
        const { answer, contentRealm, legacy } = await page.evaluate(() => ({ ...document.documentElement.dataset }))
        const [payload, service, handler, workerRealm] = answer.split('|')
        assert.deepEqual([payload, service, handler, legacy], ['hello', 'service', 'handler', expectedLegacy])
        assert(workerRealm && workerRealm !== contentRealm)
        return workerRealm
      }
      for await (const [{ versions }] of onRegistration) {
        if (versions.some(v => v.scriptURL === 'chrome-extension://' + id + '/background.js' && v.status === 'activated')) break
      }
      const first = await probe()
      let stopping = false
      for await (const [{ versions }] of updates) {
        const worker = versions.find(v => v.status === 'activated' && v.scriptURL === 'chrome-extension://' + id + '/background.js')
        if (!worker) continue
        if (stopping && worker.runningStatus === 'stopped') break
        if (!stopping) {
          stopping = true
          await lifecycle.send('ServiceWorker.stopWorker', { versionId: worker.versionId })
        }
      }
      assert.notEqual(await probe(), first)
      console.log('PASS production, realm graphs, legacy once, independent protocol state, stopped worker wake', ctx.browser().version())
    } finally {
      await updates.return()
    }
  } finally {
    await ctx.close()
  }
}

async function watch(origin, state) {
  const absent = value => ['unavailable', 'channelClosed', 'noHandler'].includes(value)
  const initial = read(entry)
  fs.unlinkSync(entry)
  const child = spawn(process.execPath, [installed.resolve('devxtension/dist/devex-scripts/index.js'),
    'dev', '--headless', '--url', origin], { stdio: ['pipe', 'pipe', 'pipe'] })
  const exit = once(child, 'exit')
  let output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output += bytes })
  const count = () => output.split('Reload complete').length - 1
  async function change(edit, check) {
    const before = count()
    const previous = state.doc
    edit()
    await until(() => count() > before && state.doc !== previous && state.legacy === '1' &&
      check(state.answer || ''), 'managed generation ' + before)
  }

  try {
    await until(() => count() && state.legacy === '1' && absent(state.answer), 'legacy generation')
    await change(() => write(entry, initial), a => a.endsWith('|entry'))
    await change(() => write(entry, initial.replace('|entry', '|second')), a => a.endsWith('|second'))
    await change(() => write(handler, read(handler).replace("'handler'", "'direct'")), a => a.includes('|direct|'))
    await change(() => write(service, "export const label = 'nested'"), a => a.includes('|nested|'))
    await change(() => write(contract, read(contract).replace("return value", "return value.replace('hello', 'shared')")), a => a.startsWith('shared|'))
    const before = count()
    const previous = state.doc
    write(service, 'export const broken = )')
    await until(() => /compiled with .*error/i.test(output), 'worker syntax error')
    await delay(500)
    assert.equal(count(), before)
    assert.equal(state.doc, previous)
    await change(() => write(service, "export const label = 'recovered'"), a => a.includes('|recovered|'))
    await change(() => fs.unlinkSync(entry), absent)
    console.log('PASS managed reload after creation, entry/direct/transitive/shared edits, failure, recovery and removal')
  } catch (error) {
    throw Error(error.message + '\n' + output.slice(-2500) + '\n' + JSON.stringify(state))
  } finally {
    child.stdin.end('q\n')
    assert.equal((await exit)[0], 0)
  }

  write(entry, initial + "\nimport './legacy.js'\n")
  const ambiguous = await build()
  assert(ambiguous.hasErrors() && ambiguous.toString('errors-only').includes('auto-executed legacy fragment'))
  console.log('PASS ambiguous import rejected')
}

async function bench() {
  const plain = read('src/runner.ts').split('document.documentElement')[0].replace(/^import .*contract'$/m, '')
  const runner = read('src/runner.ts')
  const background = read(entry)
  for (const typed of [false, true]) {
    if (typed) write(entry, background)
    else fs.unlinkSync(entry)
    write('src/runner.ts', typed ? runner : plain)
    for (let i = 0; i < 3; i++) {
      const start = performance.now()
      const stats = await build()
      assert(!stats.hasErrors(), stats.toString('errors-only'))
      const files = fs.readdirSync('dist').map(f => [f, fs.statSync('dist/' + f).size])
      if (!typed) assert(!resources(stats, stats.compilation.namedChunks.has('runner') ? 'runner' : 'main').some(f => f.includes('/dist/messaging/')))
      console.log(JSON.stringify({ typed, buildMs: Math.round(performance.now() - start), bytes: Object.fromEntries(files) }))
    }
    const compiler = webpack(config('dev'))
    const times = []
    let start
    await new Promise((resolve, reject) => {
      const watcher = compiler.watch({}, (err, stats) => {
        if (err || stats.hasErrors()) return watcher.close(() => reject(err || Error(stats.toString('errors-only'))))
        if (start) times.push(Math.round(performance.now() - start))
        if (times.length === 3) return watcher.close(() => compiler.close(resolve))
        setTimeout(() => {
          start = performance.now()
          fs.appendFileSync('src/runner.ts', '\n// rebuild ' + times.length)
        }, 150)
      })
    })
    console.log(JSON.stringify({ typed, runnerRebuildMs: times }))
  }
}

async function main() {
  const state = {}
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/seen?')) Object.assign(state, Object.fromEntries(new URL(req.url, 'http://localhost').searchParams))
    res.setHeader('Content-Type', 'text/html')
    res.end(`<html><body><script>const doc = crypto.randomUUID(); setInterval(() => fetch('/seen?' +
      new URLSearchParams({doc, ...document.documentElement.dataset})).catch(() => {}), 100)</script></body></html>`)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = 'http://127.0.0.1:' + server.address().port
  const previous = process.cwd()
  try {
    fs.cpSync(path.join(__dirname, 'fixture'), root, { recursive: true })
    process.chdir(root)
    write('.env', '')
    write(entry, read(entry).replace('http://127.0.0.1:PORT', origin))
    if (process.argv.includes('--bench')) await bench()
    else {
      fs.copyFileSync(path.join(consumer, 'tsconfig.json'), 'tsconfig.json')
      execFileSync(process.execPath, [installed.resolve('typescript/bin/tsc'), '--noEmit', '--skipLibCheck'], { stdio: 'inherit' })
      const fragment = read(legacy)
      fs.unlinkSync(legacy)
      await production(origin, '0')
      write(legacy, fragment)
      await production(origin, '1')
      await watch(origin, state)
    }
  } finally {
    process.chdir(previous)
    server.closeAllConnections()
    server.close()
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
