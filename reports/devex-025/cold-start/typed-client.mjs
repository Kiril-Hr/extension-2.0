import { background, protocol } from '../verification/contract.mjs'

const client = protocol.client('content')
export const identify = () => client.request('identify', null, background)
