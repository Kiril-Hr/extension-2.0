import { protocol } from '../../messaging/contract'
import { identify } from './handlers'

const endpoint = protocol.endpoint('background', { contentOrigins: ['http://127.0.0.1:PORT'] })
endpoint.register({ identify: ({ payload }) => ({ ok: true, value: identify(payload) + '|entry' }) })
