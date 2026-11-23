import { defineProtocol, event, request } from 'devxtension/messaging'

const json = { parse: value => value }
const query = (from, to = 'background') => request({ from, to, payload: json, response: json, error: json })
const specs = {
  identify: query(['content', 'popup']),
  restricted: query(['popup']),
  domain: query(['content']),
  missing: query(['content']),
  hold: query(['content']),
  notice: event({ from: ['content'], to: 'background', payload: json }),
  ping: query(['background'], 'content')
}

export const protocol = defineProtocol('matrix', 1, specs)
export const strict = defineProtocol('strict', 1, specs)
export const mismatch = defineProtocol('matrix', 2, specs)
export const background = { role: 'background' }
export const success = value => ({ ok: true, value })
