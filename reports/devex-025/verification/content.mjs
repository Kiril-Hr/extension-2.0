import { background, mismatch, protocol, strict, success } from './contract.mjs'

const client = protocol.client('content')
const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime)
let sends = 0
let callbacks = 0
let hits = 0
let callbackAt
chrome.runtime.sendMessage = (message, callback) => {
  sends++
  return nativeSend(message, (...args) => {
    callbacks++
    if (TRACE_COLD) callbackAt = new Date().toISOString()
    callback(...args)
  })
}

protocol.endpoint('content').register({
  ping({ payload, sender }) {
    hits++
    if (payload === 'hold') return new Promise(() => {})
    return success({ path: location.pathname, hits, sender })
  }
})

const operations = new Map()
globalThis.testPort = {
  call: (name, payload = null) => client.request(name, payload, background),
  async firstIdentify() {
    const started = new Date().toISOString()
    const previous = sends
    const result = await client.request('identify', null, background)
    return { started, callbackAt: callbackAt || null, settled: new Date().toISOString(), outbound: sends - previous, result }
  },
  strict: () => strict.client('content').request('identify', null, background),
  version: () => mismatch.client('content').request('identify', null, background),
  // The local role selector changes eligible method names, never Chrome metadata.
  restricted: () => protocol.client('popup').request('restricted', { role: 'popup' }, background),
  notify: () => client.notify('notice', 'notice', background),
  control: (action, data) => nativeSend({ fixture: true, action, ...data }),
  stats: () => ({ hits, sends, callbacks }),
  async unclaimed(field) {
    const message = { marker: 'devxtension/messaging', protocol: 'matrix', version: 1, id: 'foreign',
      to: 'background', kind: 'request', name: 'identify', data: null }
    if (field === 'protocol') message.protocol = 'unowned'
    else message.to = 'popup'
    return new Promise(resolve => nativeSend(message, result => {
      const error = chrome.runtime.lastError
      resolve({ replied: result != null, channelError: !!error })
    }))
  },
  async latency() {
    const durations = []
    for (let i = 0; i < 25; i++) {
      const start = performance.now()
      const result = await client.request('identify', null, background)
      if (!result.ok) throw Error(result.code)
      durations.push(performance.now() - start)
    }
    durations.sort((a, b) => a - b)
    return { samples: durations.length, medianMs: durations[12], maxMs: durations[24] }
  },
  start(id, timeoutMs) {
    const abort = new AbortController()
    const operation = { settlements: 0, abort }
    operation.promise = client.request('hold', id, background, { timeoutMs, signal: abort.signal }).then(result => {
      operation.settlements++
      return result
    })
    operations.set(id, operation)
    return true
  },
  cancel: id => { operations.get(id).abort.abort(); return true },
  async outcome(id) {
    const operation = operations.get(id)
    const result = await operation.promise
    return { result, settlements: operation.settlements }
  }
}
