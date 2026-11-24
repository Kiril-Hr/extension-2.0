const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { on } = require('node:events')
const { createRequire } = require('node:module')
const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH)

const consumer = path.resolve(process.argv[2])
const installed = createRequire(path.join(consumer, 'package.json'))
const workspace = fs.mkdtempSync(path.join(consumer, 'run-'))
const out = path.join(workspace, 'extension')
const write = (name, value) => fs.writeFileSync(path.join(workspace, name), value)
const pass = label => console.log('PASS ' + label)

function fixture(origin) {
  write('contract.mjs', `
import { defineProtocol, request } from 'devxtension/messaging'

const json = { parse(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected object')
  return value
} }
const command = (from, to) => request({ from, to, payload: json, response: json, error: json })
export const smoke = defineProtocol('chromium-smoke', 1, {
  identify: command(['content', 'popup'], 'background'),
  openPopup: command(['content'], 'background'),
  popupStatus: command(['content'], 'background'),
  popupConfirm: command(['popup'], 'background'),
  target: command(['content'], 'background'),
  ping: command(['background'], 'content')
})
export const ok = value => ({ ok: true, value })
`)
  write('worker.mjs', `
import { smoke, ok } from './contract.mjs'

const boot = crypto.randomUUID()
const endpoint = smoke.endpoint('background', { contentOrigins: [${JSON.stringify(origin)}], allowSubframes: true })
const client = smoke.client('background')
let popupStatus = {}
endpoint.register({
  identify: ({ sender }) => ok({ sender, boot }),
  target: async ({ payload }) => ok(await client.request('ping', {}, payload)),
  openPopup: async () => { await chrome.action.openPopup(); return ok({ opened: true }) },
  popupConfirm: ({ sender, payload }) => { popupStatus = { sender, received: payload }; return ok({}) },
  popupStatus: () => ok(popupStatus)
})
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (m?.kind === 'legacy-smoke') respond({ legacy: true })
})
`)
  write('content.mjs', `
import { smoke, ok } from './contract.mjs'

const client = smoke.client('content')
const to = { role: 'background' }
const root = document.documentElement
let calls = 0
smoke.endpoint('content').register({
  ping: ({ sender }) => {
    root.dataset.calls = String(++calls)
    return ok({ sender, path: location.pathname, calls })
  }
})
root.addEventListener('smoke', async () => {
  const { name, data } = JSON.parse(root.dataset.command)
  const result = name === 'legacy' ? await chrome.runtime.sendMessage({ kind: 'legacy-smoke' })
    : await client.request(name, data, to)
  root.dataset.reply = JSON.stringify(result)
})
client.request('identify', {}, to).then(result => { root.dataset.identity = JSON.stringify(result) })
`)
  write('popup.mjs', `
import { smoke } from './contract.mjs'
const client = smoke.client('popup')
const to = { role: 'background' }
client.request('identify', {}, to).then(received => client.request('popupConfirm', received, to))
`)
}

async function build(origin) {
  fixture(origin)
  const compiler = installed('webpack')({
    context: workspace, mode: 'production', entry: {
      worker: './worker.mjs', content: './content.mjs', popup: './popup.mjs'
    }, output: { path: out, filename: '[name].js' }
  })
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((e, stats) => e ? reject(e) : resolve(stats)))
    assert(!stats.hasErrors(), stats.toString({ all: false, errors: true }))
  } finally {
    await new Promise((resolve, reject) => compiler.close(e => e ? reject(e) : resolve()))
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'DevEx packaged messaging smoke', version: '1.0.0',
    background: { service_worker: 'worker.js' },
    action: { default_popup: 'popup.html' },
    content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'], all_frames: true }]
  }))
  fs.writeFileSync(path.join(out, 'popup.html'), '<!doctype html><title>Action popup</title><script src="popup.js"></script>')
  pass('Webpack production bundle from installed package')
}

async function read(frame, key) {
  await frame.waitForFunction(key => !!document.documentElement.dataset[key], key, { timeout: 10000 })
  return frame.evaluate(key => JSON.parse(document.documentElement.dataset[key]), key)
}

async function command(frame, name, data = {}) {
  await frame.evaluate(value => {
    const root = document.documentElement
    delete root.dataset.reply
    root.dataset.command = JSON.stringify(value)
    root.dispatchEvent(new Event('smoke'))
  }, { name, data })
  return read(frame, 'reply')
}

function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.value
}

async function stopWorker(page, script) {
  const session = await page.context().newCDPSession(page)
  const updates = on(session, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(20000) })
  let requested
  try {
    await session.send('ServiceWorker.enable')
    for await (const [{ versions }] of updates) {
      const version = versions.find(v => v.status === 'activated' && v.scriptURL === script)
      if (!version) continue
      if (requested === version.versionId && version.runningStatus === 'stopped') return
      if (requested) continue
      requested = version.versionId
      await session.send('ServiceWorker.stopWorker', { versionId: requested })
    }
  } finally {
    await updates.return()
    await session.detach()
  }
}

async function smoke(origin) {
  const context = await chromium.launchPersistentContext(path.join(workspace, 'profile'), {
    headless: true, channel: 'chromium', chromiumSandbox: true,
    ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging']
  })
  try {
    const version = context.browser().version()
    assert.match(version, /^141\./)
    console.log('Chromium ' + version)
    const session = await context.browser().newBrowserCDPSession()
    const { id } = await session.send('Extensions.loadUnpacked', { path: out })
    await session.detach()
    const page = await context.newPage()
    await page.goto(origin)
    const main = value(await read(page.mainFrame(), 'identity'))
    const frame = page.frames().find(frame => frame.parentFrame())
    assert(frame)
    const a = value(await read(frame, 'identity'))
    const { tabId, frameId, documentId } = a.sender
    assert.equal(main.sender.frameId, 0)
    assert.equal(main.sender.tabId, tabId)
    assert.equal(a.sender.role, 'content')
    assert.equal(a.sender.origin, origin)
    assert(frameId > 0 && documentId)
    pass('top frame and iframe content request with verified sender')

    const workerUrl = 'chrome-extension://' + id + '/worker.js'
    const target = address => command(page.mainFrame(), 'target', { role: 'content', tabId, ...address }).then(value)
    const first = value(await target({ documentId }))
    assert.deepEqual(first, { sender: { role: 'background', extensionId: id }, path: '/a', calls: 1 })
    assert.deepEqual(await command(page.mainFrame(), 'legacy'), { legacy: true })
    pass('document-targeted worker request and legacy native listener coexistence')

    assert.deepEqual(value(await command(page.mainFrame(), 'openPopup')), { opened: true })
    let popup
    const deadline = Date.now() + 8000
    do {
      popup = value(await command(page.mainFrame(), 'popupStatus'))
      if (!popup.sender) await new Promise(resolve => setTimeout(resolve, 50))
    } while (!popup.sender && Date.now() < deadline)
    const popupSender = { role: 'popup', url: 'chrome-extension://' + id + '/popup.html' }
    assert.deepEqual(popup.sender, popupSender)
    assert.deepEqual(value(popup.received), { sender: popupSender, boot: a.boot })
    pass('real action popup request and verified packaged sender')

    await frame.goto(origin + '/b')
    const b = value(await read(frame, 'identity'))
    assert.equal(b.sender.tabId, tabId)
    assert.equal(b.sender.frameId, frameId)
    assert.notEqual(b.sender.documentId, documentId)
    const stale = await target({ documentId })
    assert.deepEqual(stale, { ok: false, kind: 'messaging', code: 'unavailable' })
    assert.equal(await frame.evaluate(() => Number(document.documentElement.dataset.calls || 0)), 0)
    assert.deepEqual(value(await target({ frameId })), {
      sender: { role: 'background', extensionId: id }, path: '/b', calls: 1
    })
    pass('stable tab and frame, replaced document, stale rejected, zero spillover, explicit frame success')

    assert.equal(b.boot, a.boot)
    await stopWorker(page, workerUrl)
    pass('CDP stop confirmed activated/stopped')
    const wake = value(await command(frame, 'identify'))
    assert.notEqual(wake.boot, b.boot)
    assert.deepEqual(wake.sender, b.sender)
    pass('first post-stop typed request wakes worker with synchronous registration')
  } finally {
    await context.close()
  }
}

async function main() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.end(req.url === '/' ? '<!doctype html><iframe src="/a"></iframe>' : '<!doctype html><title>Frame</title>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  try {
    await build(origin)
    await smoke(origin)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
