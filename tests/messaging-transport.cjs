const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const consumer = path.resolve(process.argv[2])
const installed = createRequire(path.join(consumer, 'package.json'))
const { defineProtocol, request, event } = installed('devxtension/messaging')
fs.copyFileSync(path.join(__dirname, 'messaging-consumer.ts'), path.join(consumer, 'messaging-consumer.ts'))
execFileSync(process.execPath, [installed.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck',
  '--target', 'ES2020', '--module', 'commonjs', 'messaging-consumer.ts'], { cwd: consumer, stdio: 'inherit' })

const base = 'chrome-extension://test/'
const page = { id: 'test', url: 'https://example.com/path', origin: 'https://example.com',
  tab: { id: 1 }, frameId: 0, documentId: 'original' }
const worker = { id: 'test', url: base + 'worker.js', origin: base.slice(0, -1) }
const popup = { ...worker, url: base + 'popup.html' }
const listeners = new Set()
let sender = page
let send
let sent = 0
let address

function deliver(message, callback) {
  sent++
  return send(message, callback)
}
global.chrome = {
  runtime: {
    id: 'test', getURL: () => base, getManifest: () => ({
      action: { default_popup: 'popup.html' }, background: { service_worker: 'worker.js' }
    }),
    onMessage: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    sendMessage: deliver
  },
  tabs: { sendMessage(tabId, message, options, cb) { address = [tabId, options]; deliver(message, cb) } }
}
const loopback = (message, callback) => [...listeners][0](message, sender, callback)
send = loopback

const text = { parse(value) { assert.equal(typeof value, 'string'); return value } }
const lookup = request({ from: ['content', 'popup'], to: 'background', payload: text, response: text, error: text })
const changed = event({ from: ['content'], to: 'background', payload: text })
const highlight = request({ ...lookup, from: ['background'], to: 'content' })
const protocol = defineProtocol('review', 1, { lookup, changed, highlight }, {
  maxBytes: 64, maxDepth: 4, maxPerSender: 1, maxPending: 2
})
const policy = { contentOrigins: ['https://example.com'] }
const bg = { role: 'background' }
const destination = { role: 'content', tabId: 1, documentId: 'original' }
const client = protocol.client('content')
const agent = protocol.client('background')
const call = (value = 'hello', options) => client.request('lookup', value, bg, options)
const code = async (promise, expected) => assert.deepEqual(await promise, { ok: false, kind: 'messaging', code: expected })

async function checkWebpackEntry() {
  // Strict ESM issuers require a fully specified package export in Webpack 5.
  const entry = path.join(consumer, 'messaging-entry.mjs')
  fs.writeFileSync(entry, "export { defineProtocol, event, request } from 'devxtension/messaging'\n")
  const compiler = installed('webpack')({
    context: consumer,
    entry,
    mode: 'production',
    target: 'webworker',
    output: { path: path.join(consumer, 'messaging-bundle'), library: { type: 'commonjs2' } }
  })
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : resolve(stats)))
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }))
    assert.equal(typeof require(path.join(consumer, 'messaging-bundle/main.js')).defineProtocol, 'function')
  } finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()))
  }

  for (const entry of ['dist', 'dist/core', 'dist/devex-scripts', 'dist/devex-scripts/index', 'dist/devex-scripts/index.js']) {
    assert(installed.resolve('devxtension/' + entry).endsWith('index.js'))
  }
}

async function main() {
  await checkWebpackEntry()
  const background = protocol.endpoint('background', policy)
  const content = protocol.endpoint('content')
  assert.equal(listeners.size, 1)
  assert.throws(() => protocol.endpoint('background', policy), /Duplicate/)
  let count = 0
  let complete
  const deferred = () => new Promise(resolve => { complete = resolve })
  const ok = value => ({ ok: true, value })
  const disposeLookup = background.register({ lookup: ({ payload, sender }) => {
    count++
    if (payload === 'wait') return deferred()
    if (payload === 'bad') return ok(1)
    if (payload === 'throw') throw Error('private handler detail')
    if (payload === 'domain') return { ok: false, kind: 'domain', error: 'missing' }
    return ok(sender.role)
  } })
  assert.throws(() => background.register({ changed() {}, lookup() {} }), /duplicate/i)
  await code(client.notify('changed', 'x', bg), 'noHandler')
  const wire = { marker: 'devxtension/messaging', protocol: 'review', version: 1, id: 'a', name: 'lookup',
    kind: 'request', to: 'background', data: 'hello' }
  function raw(extra, who = sender) {
    let response
    const claim = [...listeners][0]({ ...wire, ...extra }, who, value => { response = value })
    return { claim, response }
  }
  for (const extra of [{ protocol: 'foreign' }, { marker: 'legacy' }, { to: 'popup' }]) {
    assert.deepEqual(raw(extra), { claim: false, response: undefined })
  }
  assert.equal(raw({ version: 2 }).response.result.code, 'unsupportedVersion')
  assert.equal(raw({ name: 'missing' }).response.result.code, 'noHandler')
  for (const bad of [1, 'x'.repeat(65), [[[[['deep']]]]], { a: NaN }]) {
    assert.equal(raw({ data: bad }).response.result.code, 'invalid')
  }
  for (const bad of [{ ...page, id: 'other' }, { ...page, origin: 'null' }, { ...page, frameId: 1 },
    { ...page, documentId: '' }, { ...page, url: 'https://other.example/' }, { ...popup, url: base + 'options.html' }, worker]) {
    assert.equal(raw({}, bad).response.result.code, 'forbidden')
  }
  assert.equal(count, 0)
  assert.deepEqual(await call(), ok('content'))
  sender = popup
  assert.deepEqual(await call(), ok('popup'))
  sender = page
  assert.deepEqual(await call('domain'), { ok: false, kind: 'domain', error: 'missing' })
  await code(call('bad'), 'invalid')
  await code(call('throw'), 'handlerFailed')

  const first = call('wait')
  await code(call(), 'busy')
  const firstDone = complete
  sender = popup
  const second = call('wait')
  sender = { ...page, documentId: 'other' }
  await code(protocol.client('content').request('lookup', 'hello', bg), 'busy')
  complete(ok('second'))
  firstDone(ok('first'))
  assert.deepEqual(await Promise.all([first, second]), [ok('first'), ok('second')])
  sender = page
  background.register({ changed: deferred })
  assert.deepEqual(await client.notify('changed', 'x', bg), ok(null))
  await code(call(), 'busy')
  complete()
  await Promise.resolve()

  const pending = call('wait')
  disposeLookup()
  complete(ok('stale'))
  await code(pending, 'aborted')
  await code(call(), 'noHandler')

  content.register({ highlight: () => ok('seen') })
  sender = worker
  assert.deepEqual(await agent.request('highlight', 'x', destination), ok('seen'))
  assert.deepEqual(address, [1, { documentId: 'original' }])
  assert.deepEqual(await agent.request('highlight', 'x', { role: 'content', tabId: 1, frameId: 0 }), ok('seen'))
  assert.deepEqual(address, [1, { frameId: 0 }])

  send = (message, callback) => {
    chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' }
    callback()
    delete chrome.runtime.lastError
  }
  const before = sent
  await code(agent.request('highlight', 'x', destination), 'unavailable')
  assert.equal(sent, before + 1)
  assert.deepEqual(address, [1, { documentId: 'original' }])
  send = (message, callback) => callback()
  await code(call(), 'channelClosed')
  for (const malformed of [ok(12), { ok: false, kind: 'domain', error: 42 }, ok('x'.repeat(65))]) {
    send = ({ marker, protocol, version, id }, callback) => callback({ marker, protocol, version, id, result: malformed })
    await code(call(), 'invalid')
  }
  send = (message, callback) => callback({ ...message, id: 'wrong' })
  await code(call(), 'invalid')

  let late
  send = (message, callback) => { late = callback }
  await code(call('x', { timeoutMs: 5 }), 'timeout')
  late()
  late()
  const signal = AbortSignal.abort()
  const previous = sent
  await code(call('x', { signal }), 'aborted')
  assert.equal(sent, previous)
  const controller = new AbortController()
  const inflight = call('x', { signal: controller.signal })
  controller.abort()
  await code(inflight, 'aborted')
  const outstanding = call()
  client.dispose()
  await code(outstanding, 'aborted')
  await code(call(), 'aborted')
  content.dispose()
  background.dispose()
  assert.equal(listeners.size, 0)
  console.log('PASS installed strict TypeScript consumer and callback transport unit tests')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
