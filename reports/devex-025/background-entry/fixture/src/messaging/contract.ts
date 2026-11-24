import { defineProtocol, request } from 'devxtension/messaging'

const string = {
  parse(value: unknown) {
    if (typeof value !== 'string') throw Error('Expected a string')
    return value
  }
}

export const realm = crypto.randomUUID()
export const protocol = defineProtocol('background-example', 1, {
  identify: request({ from: ['content'], to: 'background', payload: string, response: string, error: string })
})
