import { protocol, strict, success } from './contract.mjs'

const boot = crypto.randomUUID()
const counts = {}
const pending = new Map()
const client = protocol.client('background')
let popup
let endpoint
let outbound = 0
const nativeSend = chrome.tabs.sendMessage.bind(chrome.tabs)
chrome.tabs.sendMessage = (...args) => {
  outbound++
  return nativeSend(...args)
}

function counted(name, handler) {
  return ctx => {
    counts[name] = (counts[name] || 0) + 1
    return handler(ctx)
  }
}

function wait({ payload }) {
  return new Promise(resolve => pending.set(payload, () => resolve(success(payload))))
}

function open() {
  endpoint = protocol.endpoint('background', { contentOrigins: [ALLOWED_ORIGIN], allowSubframes: true })
  endpoint.register({
    identify: counted('identify', ({ sender }) => success({ sender, boot })),
    restricted: counted('restricted', () => success('popup')),
    domain: counted('domain', () => ({ ok: false, kind: 'domain', error: 'missing' })),
    hold: counted('hold', wait),
    notice: counted('notice', wait)
  })
}
open()
strict.endpoint('background', { contentOrigins: [ALLOWED_ORIGIN], popupPath: '/other.html' }).register({
  identify: counted('strict', ({ sender }) => success(sender))
})

// Out-of-band fixture observations stay on the extension channel. Pages have no bridge.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.fixture !== true || sender.id !== chrome.runtime.id) return false
  switch (message.action) {
    case 'snapshot': respond({ counts, pending: [...pending.keys()], outbound, boot, popup }); break
    case 'release':
      for (const resolve of pending.values()) resolve()
      pending.clear()
      respond(true)
      break
    case 'reopen': endpoint.dispose(); open(); respond(true); break
    case 'ping':
      client.request('ping', message.payload, message.target).then(respond)
      return true
    case 'openPopup': chrome.action.openPopup().then(() => respond(true)); return true
    case 'popupResult': popup = message.result; respond(true); break
    default: return false
  }
  return false
})
