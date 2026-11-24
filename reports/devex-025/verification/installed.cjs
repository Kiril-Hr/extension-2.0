const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')

const consumer = path.resolve(process.argv[2])
const installed = createRequire(path.join(consumer, 'package.json'))
const scratch = fs.mkdtempSync(path.join(consumer, 'controls-'))
const { defineProtocol, request } = installed('devxtension/messaging')

function compilation() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../tests/messaging-consumer.ts'), 'utf8')
  const lines = source.split(/\r?\n/)
  const expected = lines.flatMap((line, i) => line.includes('@ts-expect-error') ? [i + 2] : [])
  const run = (name, content) => {
    fs.writeFileSync(path.join(scratch, name), content)
    return spawnSync(process.execPath, [
      installed.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--target', 'ES2020',
      '--module', 'commonjs', '--pretty', 'false', name
    ], { cwd: scratch, encoding: 'utf8' })
  }
  assert.equal(run('positive.ts', source).status, 0)
  const negative = run('negative.ts', lines.map(s => s.includes('@ts-expect-error') ? '' : s).join('\n'))
  const failed = [...negative.stdout.matchAll(/negative\.ts\((\d+),/g)].map(m => Number(m[1]))
  assert.notEqual(negative.status, 0)
  assert.deepEqual([...new Set(failed)], expected)
  console.log('strict consumer exit 0; stripped control exit', negative.status, 'rejected lines', expected.join(','))

  fs.writeFileSync(path.join(scratch, 'exports.mjs'),
    "import { defineProtocol, event, request } from 'devxtension/messaging'\n" +
    "if (![defineProtocol,event,request].every(f => typeof f === 'function')) throw Error('bad ESM export')\n")
  const esm = spawnSync(process.execPath, ['exports.mjs'], { cwd: scratch, encoding: 'utf8' })
  assert.equal(esm.status, 0, esm.stderr)
}

let listener
let calls = 0
let sends = 0
const page = { id: 'fixture', url: 'https://example.com/page', origin: 'https://example.com',
  documentId: 'document', frameId: 0, tab: { id: 1 } }
global.chrome = { runtime: {
  id: 'fixture', getURL: () => 'chrome-extension://fixture/', getManifest: () => ({}),
  onMessage: { addListener: fn => { listener = fn }, removeListener: () => { listener = undefined } },
  sendMessage(message, callback) {
    sends++
    listener(message, page, callback)
  }
} }

const schema = { parse(value) {
  if (!value || Object.keys(value).join() !== 'body') throw Error('schema')
  return value
} }
const any = { parse: value => value }
const spec = request({ from: ['content'], to: 'background', payload: schema, response: schema, error: any })
const proto = defineProtocol('controls', 1, { echo: spec })
const client = proto.client('content')
const endpoint = proto.endpoint('background', { contentOrigins: [page.origin] })
endpoint.register({ echo({ payload }) {
  calls++
  return { ok: true, value: payload.body === 'invalidReply' ? { wrong: 1 } : payload }
} })
const send = payload => client.request('echo', payload, { role: 'background' })
const base = { marker: 'devxtension/messaging', protocol: 'controls', version: 1,
  id: 'a', name: 'echo', to: 'background', kind: 'request', data: { body: 'ok' } }

function nativeControl(label, message, sender, code) {
  const before = calls
  let reply
  const claimed = listener(message, sender, value => { reply = value })
  assert.equal(claimed, false)
  assert.equal(reply?.result.code, code)
  assert.equal(calls, before)
  console.log(label, code || 'unclaimed', 'handler delta', calls - before)
}

async function validation() {
  for (const field of ['id', 'origin', 'url', 'frameId', 'tab', 'documentId']) {
    const sender = { ...page }
    delete sender[field]
    nativeControl('missing ' + field, base, sender, 'forbidden')
  }
  nativeControl('foreign extension ID', base, { ...page, id: 'other' }, 'forbidden')
  nativeControl('unknown protocol', { ...base, protocol: 'other' }, page)
  nativeControl('unknown destination', { ...base, to: 'other' }, page)
  nativeControl('extra envelope key', { ...base, extra: true }, page, 'invalid')

  const cycle = {}
  cycle.body = cycle
  const invalid = {
    cycle, undefined: { body: undefined }, infinity: { body: Infinity }, nan: { body: NaN },
    unknownKey: { body: 'value', extra: true }, depth: { body: Array.from({ length: 18 }).reduce(v => [v], 0) },
    width: { body: Object.fromEntries(Array.from({ length: 16000 }, (_, i) => ['k' + i, 1])) },
    bytes: { body: 'x'.repeat(65536) }
  }
  for (const [label, payload] of Object.entries(invalid)) {
    const before = calls
    const outbound = sends
    assert.equal((await send(payload)).code, 'invalid', label)
    assert.equal(calls, before)
    assert.equal(sends, outbound)
    console.log(label, 'invalid; outbound and invocation deltas 0')
  }
  const before = calls
  assert.equal((await send({ body: 'invalidReply' })).code, 'invalid')
  assert.equal(calls - before, 1)
  console.log('invalid reply; handler delta 1')
}

async function exoticArray() {
  const foreign = require('node:vm').runInNewContext('[1, 2]')
  const accepted = await send({ body: foreign })
  assert(accepted.ok, 'ordinary arrays from another realm retain JSON array semantics')
  class Items extends Array {}
  const before = calls
  const outbound = sends
  const result = await send({ body: new Items(1, 2) })
  console.log('array subclass:', JSON.stringify({ ok: result.ok, code: result.code, calls: calls - before, sends: sends - outbound }))
  assert.equal(result.code, 'invalid', 'ADR rejects exotic prototypes')
  assert.equal(calls, before)
  assert.equal(sends, outbound)
}

async function cleanup() {
  const { getEventListeners } = require('node:events')
  const timers = () => process.getActiveResourcesInfo().filter(type => type === 'Timeout').length
  const initial = timers()
  const original = chrome.runtime.sendMessage
  const callbacks = []
  chrome.runtime.sendMessage = (message, receive) => callbacks.push(receive)
  const scoped = proto.client('content')
  const abort = new AbortController()
  const settlements = Array(8).fill(0)
  const before = calls
  try {
    const operations = settlements.map((_, index) => scoped.request('echo', { body: index },
      { role: 'background' }, { signal: abort.signal }).then(result => {
      settlements[index]++
      return result
    }))
    assert.equal(callbacks.length, 8)
    assert.equal(timers() - initial, 8)
    assert.equal(getEventListeners(abort.signal, 'abort').length, 8)
    scoped.dispose()
    for (const result of await Promise.all(operations)) assert.equal(result.code, 'aborted')
    assert.equal(timers(), initial)
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0)
    for (const receive of callbacks) receive(null)
    assert(settlements.every(n => n === 1))
    assert.equal(calls, before)
    console.log('client disposal: timers and abort listeners 8 -> 0; handler delta 0; eight single settlements')
  } finally {
    scoped.dispose()
    chrome.runtime.sendMessage = original
  }
}

async function measure() {
  const { checkJson, defaults } = installed('devxtension/dist/messaging/wire.js')
  for (const payload of [1024, 16384, 65536, 'array'].map(n => ({
    body: n === 'array' ? Array(16000).fill(123) : 'x'.repeat(n - 11)
  }))) {
    const iterations = Array.isArray(payload.body) ? 25 : 150
    const bytes = Buffer.byteLength(JSON.stringify(payload))
    for (let i = 0; i < 10; i++) assert((await send(payload)).ok)
    global.gc()
    const heapBefore = process.memoryUsage().heapUsed
    const cpu = process.cpuUsage()
    const start = performance.now()
    for (let i = 0; i < iterations; i++) checkJson(payload, defaults)
    const validMs = performance.now() - start
    const validationCpu = process.cpuUsage(cpu)
    const requestCpuStart = process.cpuUsage()
    const requestStart = performance.now()
    for (let i = 0; i < iterations; i++) assert((await send(payload)).ok)
    const requestMs = performance.now() - requestStart
    const requestCpu = process.cpuUsage(requestCpuStart)
    global.gc()
    console.log(JSON.stringify({ bytes, iterations, checkUs: validMs * 1000 / iterations,
      checkCpuUs: (validationCpu.user + validationCpu.system) / iterations,
      requestUs: requestMs * 1000 / iterations, requestCpuUs: (requestCpu.user + requestCpu.system) / iterations,
      postGcHeapDeltaBytes: process.memoryUsage().heapUsed - heapBefore }))
  }
}

async function main() {
  if (process.argv.includes('--only-regression')) return exoticArray()
  compilation()
  await validation()
  await exoticArray()
  await cleanup()
  await measure()
}
main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => {
  client.dispose()
  endpoint.dispose()
  assert.equal(listener, undefined)
})
