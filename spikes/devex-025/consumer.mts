import { defineProtocol, type Validator, type RequestClient, type SenderOf } from './contract.js'
import { defineExtensionMessaging } from '@webext-core/messaging'

declare const lookup: Validator<{ id: string }>
declare const count: Validator<number>
declare const missing: Validator<{ code: 'missing' }>

const spec = defineProtocol({
  lookup: { from: ['content', 'popup'], to: 'background', kind: 'request', payload: lookup, response: count, error: missing },
  length: { from: ['popup'], to: 'background', kind: 'request', payload: count, response: count, error: missing },
  mark: { from: ['background'], to: 'content', kind: 'request', payload: lookup, response: count, error: missing },
  update: { from: ['content'], to: 'background', kind: 'event', payload: lookup, response: count, error: missing }
})

declare const popup: RequestClient<typeof spec, 'popup'>
declare const content: RequestClient<typeof spec, 'content'>
declare const worker: RequestClient<typeof spec, 'background'>
declare const sender: SenderOf<typeof spec.lookup>
declare const name: 'length' | 'lookup'
const bg = { role: 'background' } as const
const result = await popup.request('lookup', { id: 'one' }, bg)
if (result.ok) result.value.toFixed()
else if (result.kind === 'domain') result.error.code satisfies 'missing'
if (sender.role === 'content') sender.documentId.toUpperCase()
await worker.request('mark', { id: 'one' }, { role: 'content', tabId: 1, documentId: 'doc' })
await worker.request('mark', { id: 'one' }, { role: 'content', tabId: 1, frameId: 0 })

// @ts-expect-error unknown message
await popup.request('absent', 3, bg)
// @ts-expect-error popup-only request
await content.request('length', 3, bg)
// @ts-expect-error correlated union must reject a payload valid for only one possible name
await popup.request(name, 3, bg)
// @ts-expect-error wrong destination
await worker.request('mark', { id: 'one' }, bg)
// @ts-expect-error choose the document or the current occupant of a frame
await worker.request('mark', { id: 'one' }, { role: 'content', tabId: 1, documentId: 'doc', frameId: 0 })
// @ts-expect-error event cannot be called as request
await content.request('update', { id: 'one' }, bg)
// @ts-expect-error popup senders have no documentId in the normalized contract
if (sender.role === 'popup') sender.documentId
// @ts-expect-error response is numeric
if (result.ok) result.value.toUpperCase()

const lib = defineExtensionMessaging<{ lookup(data: { id: string }): number }>()
await lib.sendMessage('lookup', { id: 'one' }, { tabId: 1, frameId: 0 })
// @ts-expect-error published SendMessageOptions has no documentId
await lib.sendMessage('lookup', { id: 'one' }, { tabId: 1, documentId: 'doc' })
