// Lab-only intervention confined to the in-memory Playwright 1.56.1 driver.
const path = require('node:path')
const { createRequire } = require('node:module')

module.exports = function instrument(row, exclude) {
  const fromPlaywright = createRequire(require.resolve(process.env.DEVEX_PLAYWRIGHT_PATH))
  const root = path.dirname(fromPlaywright.resolve('playwright-core/package.json'))
  if (require(path.join(root, 'package.json')).version !== '1.56.1') throw Error('Driver version mismatch')
  const { CRConnection } = require(path.join(root, 'lib/server/chromium/crConnection.js'))
  const proto = CRConnection.prototype
  const send = proto._rawSend
  const receive = proto._onMessage
  const sessions = new Set()
  const resumes = new Set()
  row.attachment = { exclude, filters: 0, events: [] }
  const record = (stage, extra) => row.attachment.events.push({ host: Date.now(), stage, ...extra })

  proto._onMessage = function (message) {
    if (message.method === 'Target.attachedToTarget' && message.params.targetInfo.type === 'service_worker') {
      sessions.add(message.params.sessionId)
      record('attached', { waiting: message.params.waitingForDebugger })
    }
    if (resumes.delete(message.id)) record('resumeReply', { error: !!message.error })
    return receive.call(this, message)
  }
  proto._rawSend = function (session, method, params) {
    if (exclude && method === 'Target.setAutoAttach' && params.autoAttach) {
      const defaults = [{ type: 'browser', exclude: true }, { type: 'tab', exclude: true }, {}]
      params = { ...params, filter: [{ type: 'service_worker', exclude: true }, ...(params.filter || defaults)] }
      row.attachment.filters++
    }
    const id = send.call(this, session, method, params)
    if (sessions.has(session) && method === 'Runtime.runIfWaitingForDebugger') {
      record('resumeSent')
      resumes.add(id)
    }
    return id
  }
  return () => {
    proto._rawSend = send
    proto._onMessage = receive
  }
}
