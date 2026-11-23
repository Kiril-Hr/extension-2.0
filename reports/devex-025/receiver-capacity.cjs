const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const { defineProtocol, request } = require(resolve(process.argv[2]))
const { setImmediate: nextTurn } = require('node:timers/promises')

const listeners = new Set()
const replies = []
let senderTab = 1
global.chrome = { runtime: {
  id: 'fixture',
  getURL: () => 'chrome-extension://fixture/',
  getManifest: () => ({}),
  onMessage: {
    addListener: listener => listeners.add(listener),
    removeListener: listener => listeners.delete(listener)
  },
  sendMessage(message, callback) {
    const listener = listeners.values().next().value
    if (!listener) return callback()
    listener(message, {
      id: 'fixture', url: 'https://example.com/', origin: 'https://example.com',
      tab: { id: senderTab }, frameId: 0, documentId: 'doc'
    }, response => {
      replies.push(response.result)
      callback(response)
    })
  }
} }

const registry = () => global[Symbol.for('devxtension/messaging/dispatcher-v1')]
const text = { parse(value) {
  assert.equal(typeof value, 'string')
  return value
} }
const protocol = defineProtocol('capacity', 1, {
  probe: request({ from: ['content'], to: 'background', payload: text, response: text, error: text })
})
const open = () => protocol.endpoint('background', { contentOrigins: ['https://example.com'] })
const client = protocol.client('content')
const send = (payload = 'A', options) => client.request('probe', payload, { role: 'background' }, options)
const deferred = () => Promise.withResolvers()
const ok = value => ({ ok: true, value })
const code = async (promise, expected) =>
  assert.deepEqual(await promise, { ok: false, kind: 'messaging', code: expected })

function snapshot(label, invoked, pending, counts, listenerCount = 1) {
  const state = registry()
  assert.equal(state.pending, pending)
  assert.deepEqual(Object.fromEntries(state.counts), counts)
  assert.equal(listeners.size, listenerCount)
  console.log(JSON.stringify({ label, invoked, pending, counts, listenerCount }))
}

async function baseline() {
  let invoked = 0
  const gate = deferred()
  const first = open()
  first.register({ probe: () => {
    invoked++
    return gate.promise
  } })
  const outstanding = Array.from({ length: 8 }, () => send('A', { timeoutMs: 30 }))
  snapshot('admitted eight', invoked, 8, { '1:0:doc': 8 })
  await Promise.all(outstanding.map(promise => code(promise, 'timeout')))
  snapshot('receiver counts after timeout', invoked, 8, { '1:0:doc': 8 })
  await code(send(), 'busy')
  assert.equal(invoked, 8)
  snapshot('eight timed out, ninth rejected', invoked, 8, { '1:0:doc': 8 })

  first.dispose()
  snapshot('disposed', invoked, 8, { '1:0:doc': 8 }, 0)
  const second = open()
  second.register({ probe: ({ payload }) => {
    invoked++
    return ok(payload)
  } })
  await code(send(), 'busy')
  assert.equal(invoked, 8)
  snapshot('reopened, original sender still busy', invoked, 8, { '1:0:doc': 8 })
  senderTab = 2
  const other = send('B')
  senderTab = 1
  snapshot('second sender admitted', invoked, 9, { '1:0:doc': 8, '2:0:doc': 1 })
  assert.deepEqual(await other, ok('B'))

  const before = replies.length
  gate.resolve(ok('old'))
  await nextTurn()
  assert.equal(replies.length - before, 8)
  assert(replies.slice(before).every(reply => reply.kind === 'messaging' && reply.code === 'aborted'))
  snapshot('old handlers settled', invoked, 0, {})
  assert.deepEqual(await send(), ok('A'))
  assert.equal(invoked, 10)
  snapshot('first sender recovered', invoked, 0, {})
  second.dispose()
}

// Application-level PoC. The existing dispatcher still owns receiver admission and replies.
function withReceiverDeadline(handler, deadlineMs) {
  const active = new Set()

  return {
    probe: async context => {
      const controller = new AbortController()
      active.add(controller)
      const timer = setTimeout(() => controller.abort('deadline'), deadlineMs)
      try {
        return await handler({ ...context, signal: controller.signal })
      } finally {
        clearTimeout(timer)
        active.delete(controller)
      }
    },
    close() {
      for (const controller of active) controller.abort('endpointClosed')
    },
    get size() { return active.size }
  }
}

async function poc() {
  let invoked = 0
  const ignore = deferred()
  const deadlineSeen = deferred()
  const closeSeen = deferred()
  const gate = deferred()
  const wrapped = withReceiverDeadline(({ payload, signal }) => {
    invoked++
    if (payload === 'quick') return ok('quick')
    if (payload === 'ignore') {
      signal.addEventListener('abort', () => deadlineSeen.resolve(signal.reason), { once: true })
      return ignore.promise
    }
    if (payload === 'clientAbort') {
      signal.addEventListener('abort', () => closeSeen.resolve(signal.reason), { once: true })
      return gate.promise
    }
    return new Promise(resolve => signal.addEventListener('abort', () => {
      resolve({ ok: false, kind: 'domain', error: signal.reason })
    }, { once: true }))
  }, 80)
  const endpoint = open()
  endpoint.register({ probe: wrapped.probe })
  assert.deepEqual(await send('quick'), ok('quick'))
  assert.equal(wrapped.size, 0)
  snapshot('PoC quick response', invoked, 0, {})

  const ignoreRequest = send('ignore', { timeoutMs: 15 })
  const cooperative = send('cooperative', { timeoutMs: 1000 })
  await code(ignoreRequest, 'timeout')
  assert.equal(await deadlineSeen.promise, 'deadline')
  assert.deepEqual(await cooperative, { ok: false, kind: 'domain', error: 'deadline' })
  assert.equal(wrapped.size, 1)
  snapshot('PoC cooperative released, ignoring retained', invoked, 1, { '1:0:doc': 1 })

  const abort = new AbortController()
  const aborted = send('clientAbort', { signal: abort.signal })
  abort.abort()
  await code(aborted, 'aborted')
  assert.equal(wrapped.size, 2)
  snapshot('PoC client abort leaves receiver accounting', invoked, 2, { '1:0:doc': 2 })

  endpoint.dispose()
  wrapped.close()
  assert.equal(await closeSeen.promise, 'endpointClosed')
  assert.equal(wrapped.size, 2)
  snapshot('PoC close requests cancellation, both still running', invoked, 2, { '1:0:doc': 2 }, 0)
  const reopened = open()
  reopened.register({ probe: ({ payload }) => {
    invoked++
    return ok(payload)
  } })
  assert.deepEqual(await send('quick'), ok('quick'))
  snapshot('PoC reopen retains old work', invoked, 2, { '1:0:doc': 2 })
  const before = replies.length
  ignore.resolve(ok('late'))
  gate.resolve(ok('late'))
  await nextTurn()
  assert.equal(wrapped.size, 0)
  assert.equal(replies.length - before, 2)
  assert(replies.slice(before).every(reply => reply.kind === 'messaging' && reply.code === 'aborted'))
  reopened.dispose()
  snapshot('PoC settled and cleaned', invoked, 0, {}, 0)
}

async function main() {
  const watchdog = setTimeout(() => {
    console.error('FAIL fixture watchdog expired')
    process.exit(1)
  }, 5000)
  try {
    await baseline()
    await poc()
    console.log('PASS receiver capacity baseline and application-level PoC')
  } finally {
    client.dispose()
    clearTimeout(watchdog)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
