import { defineProtocol, event, request, Validator, Request, Response, DomainError } from 'devxtension/messaging'

const string: Validator<string> = { parse(value) {
  if (typeof value !== 'string') throw Error()
  return value
} }
const number: Validator<number> = { parse(value) {
  if (typeof value !== 'number') throw Error()
  return value
} }
const lookup = request({ from: ['content', 'popup'], to: 'background', payload: string, response: number, error: string })
const highlight = request({ from: ['background'], to: 'content', payload: number, response: string, error: number })
const changed = event({ from: ['content'], to: 'background', payload: string })
const review = defineProtocol('review', 1, { lookup, highlight, changed })
const client = review.client('content')
const background = { role: 'background' } as const

declare const id: Request<typeof lookup>
client.request('lookup', id, background).then(result => {
  if (result.ok) { const value: Response<typeof lookup> = result.value }
  else if (result.kind === 'domain') { const message: DomainError<typeof lookup> = result.error }
})
client.notify('changed', 'x', background)
review.client('background').request('highlight', 7, { role: 'content', tabId: 1, frameId: 0 })
review.client('background').request('highlight', 7, { role: 'content', tabId: 1, documentId: 'doc' })

const endpoint = review.endpoint('background', { contentOrigins: ['https://example.com'] })
const release = endpoint.register({
  lookup: ({ payload, sender }) => ({ ok: true, value: sender.role === 'content' ? sender.frameId : payload.length })
})
release()
endpoint.dispose()

// @ts-expect-error request payload follows the name
client.request('lookup', 1, background)
// @ts-expect-error unknown message name
client.request('missing', 'x', background)
// @ts-expect-error wrong receiving role
client.request('lookup', 'x', { role: 'content', tabId: 1, frameId: 0 })
// @ts-expect-error wrong direction
client.request('highlight', 1, background)
// @ts-expect-error event requires notify
client.request('changed', 'x', background)
// @ts-expect-error popup cannot send changed
review.client('popup').notify('changed', 'x', background)
// @ts-expect-error destination cannot combine addressing modes
review.client('background').request('highlight', 1, { role: 'content', tabId: 1, frameId: 0, documentId: 'd' })
// @ts-expect-error no broadcast
review.client('background').request('highlight', 1, { role: 'content', tabId: 1 })
// @ts-expect-error response must be numeric
endpoint.register({ lookup: () => ({ ok: true, value: 'bad' }) })
// @ts-expect-error domain errors use the declared validator
endpoint.register({ lookup: () => ({ ok: false, kind: 'domain', error: 1 }) })
// @ts-expect-error events have no application response
endpoint.register({ changed: () => 'result' })
// @ts-expect-error sender can also be a popup
endpoint.register({ lookup: ({ sender }) => ({ ok: true, value: sender.frameId }) })
// @ts-expect-error wrong destination
endpoint.register({ highlight: () => ({ ok: true, value: 'bad' }) })

const both = defineProtocol('union', 1, { lookup, count: request({ ...lookup, payload: number }) }).client('content')
declare const name: 'lookup' | 'count'
// @ts-expect-error union input must preserve the name/payload pairing
both.request(name, 123, background)
declare const args: ['lookup', string, typeof background] | ['count', number, typeof background]
both.request(...args)
