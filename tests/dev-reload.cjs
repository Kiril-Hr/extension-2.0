const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

async function main() {
  const minimal = path.resolve(process.argv[2])
  const binary = require.resolve('devxtension/dist/devex-scripts/index.js', { paths: [minimal] })
  const project = fs.mkdtempSync(path.join(minimal, 'reload-test-'))
  const runnerFile = path.join(project, 'src/runner.ts')
  const moduleFile = path.join(project, 'src/modules/hello.ts')
  const origin = 'http://127.0.0.2'
  let otherLoads = 0
  let observation
  let reports = 0
  let holdNavigation
  let releaseNavigation
  let overlapping = false

  // This page reports the DOM produced by the installed extension. A second
  // real tab counts navigations independently of the managed tab.
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const url = new URL(req.url, origin)
    if (url.pathname === '/other') {
      otherLoads++
      return res.end('Separate tab')
    }
    if (url.pathname === '/observed') {
      observation = Object.fromEntries(url.searchParams)
      reports++
      return res.end()
    }

    if (url.pathname === '/spa') {
      if (releaseNavigation) overlapping = true
      if (holdNavigation) {
        holdNavigation = false
        await new Promise(resolve => { releaseNavigation = resolve })
        releaseNavigation = undefined
      }
    }
    res.setHeader('Content-Type', 'text/html')
    res.end(`<!doctype html><title>DevEx Reload</title><body><script>
      if (!sessionStorage.opened) {
        sessionStorage.opened = 'yes'
        window.open('/other', '_blank')
        history.pushState({}, '', '/spa')
      }
      const doc = crypto.randomUUID()
      setInterval(() => {
        const data = document.documentElement.dataset
        const state = new URLSearchParams({ doc, path: location.pathname, runner: data.runner || '',
          manifest: data.manifest || '', worker: data.worker || '', boot: data.boot || '', module: document.querySelector('#devex-hello')?.textContent || '' })
        fetch('/observed?' + state).catch(() => {})
      }, 150)
    </script></body>`)
  })
  const productionManifest = JSON.parse(fs.readFileSync(path.join(minimal, 'dist/manifest.json'), 'utf8'))
  assert.deepEqual(productionManifest.permissions, ['webNavigation'])
  assert.deepEqual(productionManifest.host_permissions, ['https://example.com/*'])
  for (const file of ['runner.js', 'background.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(minimal, 'dist', file), 'utf8'), /Extensions\.loadUnpacked|playwright-core|DevExReload/)
  }

  const runner = fs.readFileSync(path.join(minimal, 'src/runner.ts'), 'utf8').replaceAll('https://example.com', origin) + `
document.documentElement.dataset.runner = 'runner-one'
document.documentElement.dataset.manifest = chrome.runtime.getManifest().version
chrome.runtime.sendMessage('probe', reply => { document.documentElement.dataset.worker = reply.version; document.documentElement.dataset.boot = reply.boot })
`
  const module = fs.readFileSync(path.join(minimal, 'src/modules/hello.ts'), 'utf8').replaceAll('https://example.com', origin)
  const background = path.join(project, 'src/extensionOptions/backgrounds/probe.js')
  fs.mkdirSync(path.dirname(moduleFile), { recursive: true })
  fs.mkdirSync(path.dirname(background), { recursive: true })
  fs.writeFileSync(background, "const boot = crypto.randomUUID(); chrome.runtime.onMessage.addListener((msg, sender, reply) => { if (msg === 'probe') reply({ version: chrome.runtime.getManifest().version, boot }) })")
  fs.writeFileSync(runnerFile, runner)
  fs.writeFileSync(moduleFile, module)
  fs.writeFileSync(path.join(project, '.env'), '')

  await new Promise((resolve, reject) => server.once('error', reject).listen(80, '127.0.0.2', resolve))
  const child = spawn(process.execPath, [binary, 'dev', '--headless', '--url', origin + '/start'], {
    cwd: project, stdio: ['pipe', 'pipe', 'pipe']
  })
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  let output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output += bytes })
  const until = async (condition, name) => {
    const deadline = Date.now() + 45000
    while (!condition() && child.exitCode === null && Date.now() < deadline) await delay(100)
    assert(condition(), name + '\n' + JSON.stringify(observation) + '\n' + output)
  }
  const reloads = () => output.split('[DevEx] Reload complete').length - 1
  const updated = async (file, source, field, value) => {
    const { doc, boot } = observation
    const count = reloads()
    fs.writeFileSync(file, source)
    await until(() => reloads() > count && observation?.doc !== doc && observation?.[field] === value &&
      observation.boot && observation.boot !== boot, field)
    assert.equal(observation.path, '/spa')
  }

  try {
    await until(() => reloads() && otherLoads === 1 && observation?.module === 'Hello from DevEx 2.0' &&
      observation?.worker === '1.0.0' && observation.runner === 'runner-one', 'Initial factory + worker')
    console.log(output.match(/Chromium [^\r\n]+/)[0])
    const next = runner.replace('runner-one', 'runner-two')
    await updated(runnerFile, next, 'runner', 'runner-two')
    await updated(moduleFile, module.replace('Hello from DevEx 2.0', 'module-two'), 'module', 'module-two')
    await updated(runnerFile, next.replace('1.0.0', '1.0.1'), 'worker', '1.0.1')
    assert.equal(observation.manifest, '1.0.1')

    const previous = { ...observation }
    const count = reloads()
    fs.writeFileSync(moduleFile, module + '\nconst broken = )')
    await until(() => /compiled with .*error/i.test(output), 'Webpack rejected syntax error')
    const before = reports
    await until(() => reports >= before + 3, 'Existing document remains active')
    assert.equal(reloads(), count)
    assert.deepEqual(observation, previous)

    // Hold a real navigation open while another burst of edits arrives.
    holdNavigation = true
    fs.writeFileSync(moduleFile, module.replace('Hello from DevEx 2.0', 'recovered'))
    await until(() => !!releaseNavigation, 'Recovery started a real navigation')
    for (const label of ['rapid-one', 'rapid-two', 'rapid-final']) {
      fs.writeFileSync(moduleFile, module.replace('Hello from DevEx 2.0', label))
    }
    releaseNavigation()
    await until(() => reloads() >= count + 2 && observation?.module === 'rapid-final' &&
      observation.worker === '1.0.1' && observation.boot && observation.boot !== previous.boot, 'Recovery after rapid edits')
    assert.notEqual(observation.doc, previous.doc)
    assert.equal(observation.worker, '1.0.1')
    assert.equal(overlapping, false)

    const valid = next.replace('1.0.0', '1.0.1')
    const beforeInvalid = reloads()
    fs.writeFileSync(runnerFile, valid.replace("version: '1.0.1'", 'version: Date.now().toString()'))
    await until(() => output.includes('Manifest must be static data'), 'Invalid Manifest reported')
    assert.equal(reloads(), beforeInvalid)
    await updated(runnerFile, valid.replace('1.0.1', '1.0.2'), 'worker', '1.0.2')
    assert.equal(otherLoads, 1)
    console.log('PASS initial, runner, module, manifest + worker, SPA path, failed compile, recovery, unrelated tab')
  } finally {
    releaseNavigation?.()
    child.stdin.on('error', () => {})
    child.stdin.end('q\n')
    let timer
    try {
      const result = await Promise.race([exited, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('CLI did not stop')), 15000)
      })])
      assert.equal(result.code, 0, output)
      const pid = Number(output.match(/Chromium .*?, PID (\d+)/)?.[1])
      assert(pid, output)
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
      console.log('PASS CLI and Chromium exited')
    } finally {
      clearTimeout(timer)
      if (child.exitCode === null && !child.signalCode) child.kill()
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
      fs.rmSync(project, { recursive: true, force: true, maxRetries: 5 })
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
