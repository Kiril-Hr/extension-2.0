const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const { on } = require('node:events')
const { setTimeout: delay } = require('node:timers/promises')
const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH)

const consumer = path.resolve(process.argv[2])
const expected = process.argv[3]
const installed = createRequire(path.join(consumer, 'package.json'))
const scratch = fs.mkdtempSync(path.join(consumer, 'verification-'))
const extension = path.join(scratch, 'extension')
const ok = result => {
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.value
}
const denied = (result, code) => assert.deepEqual(result, { ok: false, kind: 'messaging', code })
const log = (scenario, evidence) => console.log(JSON.stringify({ scenario, evidence }))

async function poll(check, label) {
  const end = Date.now() + 10000
  do {
    const value = await check()
    if (value) return value
    await delay(25)
  } while (Date.now() < end)
  throw Error('Missing observation: ' + label)
}

async function build(origin) {
  const webpack = installed('webpack')
  const compiler = webpack({
    context: __dirname, mode: 'production', entry: {
      content: './content.mjs', worker: './worker.mjs', popup: './popup.mjs'
    }, resolve: { modules: [path.join(consumer, 'node_modules')] },
    output: { path: extension, filename: '[name].js' },
    plugins: [new webpack.DefinePlugin({ ALLOWED_ORIGIN: JSON.stringify(origin) })]
  })
  try {
    const stats = await new Promise((res, rej) => compiler.run((e, stats) => e ? rej(e) : res(stats)))
    assert(!stats.hasErrors(), stats.toString({ all: false, errors: true }))
  } finally {
    await new Promise((res, rej) => compiler.close(e => e ? rej(e) : res()))
  }
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Transport verification', version: '1.0.0',
    background: { service_worker: 'worker.js' }, action: { default_popup: 'popup.html' },
    content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'], all_frames: true }]
  }))
  fs.writeFileSync(path.join(extension, 'popup.html'), '<script src="popup.js"></script>')
}

async function tab(context, url) {
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  const worlds = new Map()
  session.on('Runtime.executionContextCreated', ({ context }) => {
    worlds.set(context.id, context.auxData)
  })
  session.on('Runtime.executionContextDestroyed', ({ executionContextId }) => worlds.delete(executionContextId))
  session.on('Runtime.executionContextsCleared', () => worlds.clear())
  await session.send('Runtime.enable')
  await page.goto(url)

  async function world(frameId) {
    const id = await poll(async () => {
      for (const [id, info] of worlds) {
        if (info?.frameId !== frameId || info.isDefault) continue
        const { result } = await session.send('Runtime.evaluate', { contextId: id, expression: '!!globalThis.testPort' })
        if (result.value) return id
      }
    }, 'extension isolated world')
    return async (method, ...args) => {
      const expression = 'testPort[' + JSON.stringify(method) + '](...' + JSON.stringify(args) + ')'
      const reply = await session.send('Runtime.evaluate', {
        contextId: id, expression, returnByValue: true, awaitPromise: true
      })
      assert(!reply.exceptionDetails, JSON.stringify(reply.exceptionDetails))
      return reply.result.value
    }
  }
  const tree = () => session.send('Page.getFrameTree').then(r => r.frameTree)
  const top = await world((await tree()).frame.id)
  const children = async () => Promise.all((await tree()).childFrames.map(child => world(child.frame.id)))
  return { page, top, children }
}

async function stop(page, script) {
  const session = await page.context().newCDPSession(page)
  const updates = on(session, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(30000) })
  let requested
  try {
    await session.send('ServiceWorker.enable')
    for await (const [{ versions }] of updates) {
      const v = versions.find(v => v.status === 'activated' && v.scriptURL === script)
      if (!v) continue
      if (requested === v.versionId && v.runningStatus === 'stopped') return
      if (!requested) {
        requested = v.versionId
        await session.send('ServiceWorker.stopWorker', { versionId: requested })
      }
    }
  } finally {
    await updates.return()
    await session.detach()
  }
}

async function matrix(context, id, origin, outside) {
  const one = await tab(context, origin)
  const two = await tab(context, origin)
  const other = await tab(context, outside)
  const a = one.top
  const control = (action, data) => a('control', action, data)
  const snapshot = () => control('snapshot')
  const getIdentity = async call => ok(await call('call', 'identify'))
  const first = await getIdentity(a)
  const second = await getIdentity(two.top)
  assert.equal(first.sender.role, 'content')
  assert.equal(first.sender.frameId, 0)
  assert.equal(first.sender.origin, origin)
  assert.notEqual(first.sender.tabId, second.sender.tabId)
  assert.equal(first.boot, second.boot)
  const [frame] = await one.children()
  const sub = await getIdentity(frame)
  assert(sub.sender.frameId > 0)
  assert.equal(sub.sender.tabId, first.sender.tabId)
  assert.equal(ok(await a('strict')).role, 'content')

  async function rejected(label, run, code) {
    const before = (await snapshot()).counts
    denied(await run(), code)
    const after = (await snapshot()).counts
    assert.deepEqual(after, before)
    log(label, { code, handlerDelta: 0 })
  }
  await rejected('disallowed iframe', () => frame('strict'), 'forbidden')
  await rejected('origin outside allowlist', () => other.top('call', 'identify'), 'forbidden')
  await rejected('content caller, popup-only ACL, role in payload', () => a('restricted'), 'forbidden')
  await rejected('known protocol, unbound handler', () => a('call', 'missing'), 'noHandler')
  await rejected('version mismatch', () => a('version'), 'unsupportedVersion')
  for (const field of ['protocol', 'destination']) {
    const before = (await snapshot()).counts
    const observation = await a('unclaimed', field)
    assert.equal(observation.replied, false)
    assert.deepEqual((await snapshot()).counts, before)
    log('unclaimed ' + field, { ...observation, handlerDelta: 0 })
  }
  const beforePopup = (await snapshot()).counts
  await control('openPopup')
  const popup = await poll(async () => (await snapshot()).popup, 'action popup')
  assert.deepEqual(ok(popup.valid).sender, { role: 'popup', url: 'chrome-extension://' + id + '/popup.html' })
  denied(popup.denied, 'forbidden')
  assert.equal((await snapshot()).counts.strict, beforePopup.strict)
  log('popup and alternate packaged path rejection', { authorized: 1, deniedHandlerDelta: 0 })

  assert.deepEqual(await a('call', 'domain'), { ok: false, kind: 'domain', error: 'missing' })
  assert.equal(ok(await a('notify')), null)
  assert((await snapshot()).pending.includes('notice'))
  await control('release')
  log('native control listener, domain failure, notification admission', (await snapshot()).counts)

  const ping = (target, payload = null) => control('ping', { target: { role: 'content', ...target }, payload })
  for (const [current, peer] of [[one, two], [two, one]]) {
    const [old] = await current.children()
    const [otherFrame] = await peer.children()
    const { tabId, frameId, documentId } = (await getIdentity(old)).sender
    const previousHits = (await otherFrame('stats')).hits
    assert.equal(ok(await ping({ tabId, documentId })).path, '/a')
    await current.page.frames().find(f => f.parentFrame()).goto(origin + '/b')
    const [fresh] = await current.children()
    const replacement = (await getIdentity(fresh)).sender
    assert.equal(replacement.tabId, tabId)
    assert.equal(replacement.frameId, frameId)
    assert.notEqual(replacement.documentId, documentId)
    const before = (await snapshot()).outbound
    denied(await ping({ tabId, documentId }), 'unavailable')
    assert.equal((await snapshot()).outbound - before, 1)
    assert.equal((await fresh('stats')).hits, 0)
    const byDoc = ok(await ping({ tabId, documentId: replacement.documentId }))
    assert.deepEqual(byDoc, { path: '/b', hits: 1, sender: { role: 'background', extensionId: id } })
    assert.equal(ok(await ping({ tabId, frameId })).hits, 2)
    assert.equal((await otherFrame('stats')).hits, previousHits)
    log('document navigation', { staleSends: 1, staleHits: 0, otherTabDelta: 0, replacementHits: 2 })
  }

  const done = async (sender, key, code) => {
    const state = await sender('outcome', key)
    assert.equal(state.settlements, 1)
    denied(state.result, code)
  }
  const held = async n => poll(async () => (await snapshot()).pending.length === n, 'pending=' + n)
  const senders = [a, ...(await one.children()), two.top, ...(await two.children())]
  const extra = await tab(context, origin + '/many')
  senders.push(extra.top, ...(await extra.children()))
  assert(senders.length >= 9)
  const beforeCapacity = (await snapshot()).counts.hold || 0
  const ops = []
  for (const [i, sender] of senders.slice(0, 8).entries()) {
    await Promise.all(Array.from({ length: 8 }, (_, j) => {
      const key = 'batch-' + i + '-' + j
      ops.push([sender, key])
      return sender('start', key, i === 0 ? 250 : 20000)
    }))
    await held((i + 1) * 8)
    if (!i) {
      await Promise.all(ops.map(([s, k]) => done(s, k, 'timeout')))
      await rejected('sender capacity after 8 deadlines', () => a('call', 'hold', 'ninth'), 'busy')
      await control('reopen')
      await rejected('sender capacity after reopen', () => a('call', 'hold', 'ninth'), 'busy')
    }
  }
  await rejected('global capacity at 64, fresh sender', () => senders[8]('call', 'hold', '65th'), 'busy')
  assert.equal((await snapshot()).counts.hold - beforeCapacity, 64)
  await control('release')
  for (const [s, key] of ops.slice(8)) assert.equal(ok((await s('outcome', key)).result), key)
  await held(0)
  log('concurrent sends and recovery', { admitted: 64, perSender: 8, globalRejected: 1, pending: 0 })

  for (const [sender, key] of ops.slice(0, 8)) await done(sender, key, 'timeout')
  log('local late settlement check', { timedOut: 8, settlementsPerRequest: 1 })
  log('real warmed typed identify round trip', await a('latency'))
  const abortHits = (await snapshot()).counts.hold
  const startLifecycle = await a('stats')
  await a('start', 'abort', 10000)
  await held(1)
  await a('cancel', 'abort')
  await done(a, 'abort', 'aborted')
  await control('release')
  await poll(async () => (await a('stats')).callbacks === startLifecycle.callbacks + 1, 'late native response')
  await done(a, 'abort', 'aborted')
  assert.equal((await a('stats')).sends, startLifecycle.sends + 1)
  assert.equal((await snapshot()).counts.hold - abortHits, 1)
  log('local abort and late response', { outbound: 1, settlements: 1, invocations: 1 })

  const beforeClose = (await snapshot()).outbound
  const closeRequest = ping({ tabId: second.sender.tabId, documentId: second.sender.documentId }, 'hold')
  await poll(async () => (await two.top('stats')).hits === 1, 'recipient entered handler')
  await two.page.close()
  const closed = await closeRequest
  denied(closed, 'channelClosed')
  assert.equal((await snapshot()).outbound, beforeClose + 1)
  log('tab closed while handling', { outbound: 1, invocations: 1, result: closed.code })

  const preStopHits = (await snapshot()).counts.hold
  const prev = await a('stats')
  await a('start', 'interrupted', 15000)
  await held(1)
  const entered = await snapshot()
  assert.equal(entered.counts.hold - preStopHits, 1)
  const priorBoot = entered.boot
  await stop(one.page, 'chrome-extension://' + id + '/worker.js')
  const interrupted = await a('outcome', 'interrupted')
  assert.equal(interrupted.settlements, 1)
  assert(!interrupted.result.ok && ['channelClosed', 'timeout'].includes(interrupted.result.code))
  assert.equal((await a('stats')).sends, prev.sends + 1)
  const awake = await getIdentity(a)
  assert.notEqual(awake.boot, priorBoot)
  assert.deepEqual(awake.sender, first.sender)
  assert.equal((await snapshot()).counts.hold || 0, 0)
  log('CDP stopped during request then wake', {
    stopped: 'activated/stopped', interrupted: interrupted.result.code, invocationsBeforeStop: 1,
    settlements: 1, outbound: 1, replayedAfterWake: 0
  })
}

async function main() {
  const servers = []
  try {
    async function serve() {
      const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html')
        const count = req.url === '/many' ? 5 : req.url === '/' ? 1 : 0
        res.end('<!doctype html><title>fixture</title>' + '<iframe src="/a"></iframe>'.repeat(count))
      })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      servers.push(server)
      return 'http://127.0.0.1:' + server.address().port
    }
    const origin = await serve()
    const outside = await serve()
    await build(origin)
    const context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
      headless: true, channel: 'chromium', executablePath: process.env.DEVEX_CHROMIUM_PATH,
      chromiumSandbox: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging']
    })
    try {
      const browser = context.browser()
      assert.equal(browser.version(), expected)
      log('browser', browser.version())
      const session = await browser.newBrowserCDPSession()
      const { id } = await session.send('Extensions.loadUnpacked', { path: extension })
      await session.detach()
      await matrix(context, id, origin, outside)
      log('PASS', browser.version())
    } finally {
      await context.close()
    }
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))))
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
