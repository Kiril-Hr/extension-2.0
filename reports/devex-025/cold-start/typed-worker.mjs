import { protocol, success } from '../verification/contract.mjs'

protocol.endpoint('background', { contentOrigins: [ORIGIN] }).register({
  identify() {
    mark('handler')
    return success('identified')
  }
})
mark('registered')
