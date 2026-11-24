const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { createRequire } = require('node:module')
const { setTimeout: delay } = require('node:timers/promises')
const { Worker } = require('node:worker_threads')
const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH)

const [consumer, output] = process.argv.slice(2)
const installed = createRequire(path.resolve(consumer, 'package.json'))
const webpack = installed('webpack')
const versions = { chromium: '141.0.7390.37', chrome: '158.0.8127.36' }
const observations = new Map()
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'devex-isolation-'))

async function build(origin, fixture) {
  const directory = path.join(scratch, fixture)
  const compiler = webpack({
    mode: 'production', context: __dirname, entry: { content: './content.mjs', implementation: './' + fixture + '-worker.mjs' },
    resolve: {
      modules: [path.resolve(consumer, 'node_modules')],
      alias: { 'fixture-client$': path.join(__dirname, fixture + '-client.mjs') }
    },
    output: { path: directory, filename: '[name].js' },
    plugins: [new webpack.DefinePlugin({ ORIGIN: JSON.stringify(origin) })]
  })
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((err, data) => err ? reject(err) : resolve(data)))
    assert(!stats.hasErrors(), stats.toString({ all: false, errors: true }))
  } finally {
    await new Promise(resolve => compiler.close(resolve))
  }

  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
    name: 'Cold start comparison', version: '1.0.0', manifest_version: 3,
    background: { service_worker: 'worker.js' },
    content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'] }]
  }))
}

function cpu() {
  const counts = os.cpus().map(core => core.times)
  return {
    idle: counts.reduce((sum, times) => sum + times.idle, 0),
    total: counts.reduce((sum, times) => sum + Object.values(times).reduce((a, b) => a + b), 0)
  }
}

async function startLoad(enabled) {
  const workers = []
  const stop = async () => Promise.all(workers.map(worker => worker.terminate()))
  try {
    if (enabled) {
      const ready = Array.from({ length: os.availableParallelism() }, () => {
        const worker = new Worker(`
          const { parentPort } = require('node:worker_threads')
          parentPort.postMessage('ready')
          let n = 1
          for (;;) n = Math.imul(n, 1664525) + 1013904223 | 0
        `, { eval: true })
        workers.push(worker)
        return once(worker, 'message')
      })
      await Promise.all(ready)
    }
    return stop
  } catch (error) {
    await stop()
    throw error
  }
}

async function trial(row, origin) {
  const { browser, fixture, trace, activated, load, id } = row
  row.host = {}
  row.worker = []
  row.versions = []
  observations.set(String(id), row.worker)
  const stamp = key => { row.host[key] = Date.now() }
  const marker = trace
    ? 'stage => { void fetch(' + JSON.stringify(origin + '/trace/' + id) +
      ', { method: "POST", body: JSON.stringify({ stage, local: Date.now() }) }).catch(() => {}) }'
    : '() => {}'
  const directory = path.join(scratch, fixture)
  fs.writeFileSync(path.join(directory, 'worker.js'),
    'self.mark = ' + marker + '\nmark("evaluate")\nimportScripts("implementation.js")\n')

  const preactivate = activated && load && !process.argv.includes('--load-before-activation')
  let stop = await startLoad(load && !preactivate)
  const restore = row.differential ? require('./attachment.cjs')(row, row.exclude) : () => {}
  const initial = cpu()
  const processStart = process.cpuUsage()
  row.freeBeforeMiB = Math.round(os.freemem() / 1048576)
  let context
  try {
    stamp('launch')
    context = await chromium.launchPersistentContext('', {
      headless: true, channel: 'chromium', chromiumSandbox: true,
      executablePath: browser === 'chrome' ? process.env.DEVEX_CHROME_158 : undefined,
      ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging']
    })
    stamp('launched')
    assert.equal(context.browser().version(), versions[browser])
    const session = await context.browser().newBrowserCDPSession()
    if (trace) {
      const observer = await context.newPage()
      const service = await context.newCDPSession(observer)
      service.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
        for (const v of versions.filter(v => v.scriptURL.endsWith('/worker.js'))) {
          row.versions.push({ host: Date.now(), status: v.status, running: v.runningStatus })
        }
      })
      await service.send('ServiceWorker.enable')
    }

    stamp('loading')
    await session.send('Extensions.loadUnpacked', { path: directory })
    stamp('loaded')
    if (activated) {
      const end = Date.now() + 45000
      while (!row.versions.some(v => v.status === 'activated' && v.running === 'running')) {
        if (Date.now() >= end) throw Error('activation precondition timed out')
        await delay(20)
      }
    }
    if (preactivate) {
      stamp('startLoad')
      stop = await startLoad(true)
      stamp('loadReady')
    }
    const page = await context.newPage()
    await page.goto(origin)
    await page.waitForSelector('html[data-probe]', { state: 'attached' })
    await page.evaluate(() => document.dispatchEvent(new Event('cold-start-probe')))
    await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.probe).result)
    const read = () => page.evaluate(() => JSON.parse(document.documentElement.dataset.probe))
    row.client = await read()
    if (row.client.result === 'timeout') {
      // Keep the first request in its original browser for a separate diagnostic window.
      await delay(12000)
      row.client = await read()
      if (row.differential && !row.client.callbacks) {
        stamp('loadRelease')
        await stop()
        stop = async () => {}
        await delay(10000)
        row.client = await read()
      }
    }
    assert.equal(row.client.sends, 1)
    if (trace) {
      const { processInfo } = await session.send('SystemInfo.getProcessInfo')
      row.processes = processInfo.reduce((counts, p) => {
        counts[p.type] = (counts[p.type] || 0) + 1
        return counts
      }, {})
    }
    stamp('observed')
  } catch (err) {
    row.error = String(err.message).split('\n')[0].replaceAll(scratch, '<scratch>')
  } finally {
    const end = cpu()
    row.cpuPct = Math.round(100 * (1 - (end.idle - initial.idle) / (end.total - initial.total)))
    row.freeAfterMiB = Math.round(os.freemem() / 1048576)
    row.driverRssMiB = Math.round(process.memoryUsage().rss / 1048576)
    row.driverCpu = process.cpuUsage(processStart)
    await stop()
    await context?.close()
    restore()
    observations.delete(String(id))
  }
}

async function main() {
  const server = http.createServer(async (req, res) => {
    const events = observations.get(req.url.split('/')[2])
    if (req.method === 'POST' && events) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      events.push({ ...JSON.parse(Buffer.concat(chunks)), received: Date.now() })
    }
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' })
    res.end('<!doctype html><title>Probe</title>')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = 'http://127.0.0.1:' + server.address().port
  const cells = []
  for (const browser of Object.keys(versions)) {
    for (const fixture of ['native', 'typed']) {
      for (const activated of [false, true]) {
        for (const load of [false, true]) cells.push({ browser, fixture, activated, load })
      }
    }
  }
  try {
    await build(origin, 'native')
    await build(origin, 'typed')
    console.log(JSON.stringify({ os: os.release(), model: os.cpus()[0].model, logical: os.cpus().length,
      loadThreads: os.availableParallelism(), ramMiB: os.totalmem() / 1048576, node: process.version }))
    const file = fs.openSync(output, 'wx')
    try {
      if (process.argv.includes('--driver-control')) {
        for (let n = 0; n < 12; n++) {
          const row = { id: n, browser: 'chromium', fixture: n % 4 < 2 ? 'native' : 'typed',
            activated: false, load: true, trace: true, differential: true, exclude: (n + Math.floor(n / 4)) % 2 === 0 }
          await trial(row, origin)
          fs.writeSync(file, JSON.stringify(row) + '\n')
          console.log(row.id, row.fixture, row.exclude, row.client?.result, row.error || '')
        }
        return
      }
      for (let round = 0; round < 6; round++) {
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[(i * 7 + round * 3) % cells.length]
          if (round === 5 && cell.activated) continue
          const row = { id: round * 16 + i, round: round + 1, ...cell, trace: round < 5 }
          await trial(row, origin)
          fs.writeSync(file, JSON.stringify(row) + '\n')
          console.log(row.id, row.browser, row.fixture, row.client?.result, row.error || '', row.cpuPct)
          if (row.error && !row.host.launched) throw Error(row.error)
        }
      }
    } finally {
      fs.closeSync(file)
    }
  } finally {
    server.close()
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
