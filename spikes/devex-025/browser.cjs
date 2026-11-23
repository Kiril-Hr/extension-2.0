const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { on } = require('node:events')
const { setTimeout: delay } = require('node:timers/promises')
const { chromium } = require('playwright-core')

async function identity(frame) {
  await frame.waitForFunction(() => !!document.documentElement.dataset.identity)
  return frame.evaluate(() => JSON.parse(document.documentElement.dataset.identity))
}

async function stopWorker(page, script) {
  const session = await page.context().newCDPSession(page)
  const updates = on(session, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(30000) })
  let stopping
  try {
    await session.send('ServiceWorker.enable')
    for await (const [{ versions }] of updates) {
      const version = versions.find(v => v.status === 'activated' && v.scriptURL === script)
      if (!version) continue
      if (version.runningStatus === 'stopped') return 'activated/stopped'
      if (stopping === version.versionId) continue
      stopping = version.versionId
      await session.send('ServiceWorker.stopWorker', { versionId: stopping })
    }
  } finally {
    await updates.return()
    await session.detach()
  }
}

async function trial(mode, origin) {
  const extension = path.resolve('dist', mode)
  const context = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium', chromiumSandbox: true,
    executablePath: process.env.DEVEX_CHROMIUM_PATH,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging']
  })
  try {
    const session = await context.browser().newBrowserCDPSession()
    const { id } = await session.send('Extensions.loadUnpacked', { path: extension })
    await session.detach()
    const page = await context.newPage()
    await page.goto(origin)
    const main = await identity(page.mainFrame())
    const frame = page.frames().find(f => f.parentFrame())
    const first = await identity(frame)
    const worker = context.serviceWorkers().find(w => w.url().endsWith('/worker.js')) ||
      await context.waitForEvent('serviceworker', w => w.url().endsWith('/worker.js'))
    const probe = target => worker.evaluate(t => globalThis.probe(t), target)
    const tabId = first.sender.tab.id
    const frameId = first.sender.frameId
    const documentId = first.sender.documentId
    assert.equal(main.sender.tab.id, tabId)
    assert.equal(main.sender.frameId, 0)
    assert(frameId > 0 && documentId)
    assert.equal(first.sender.id, id)
    assert.equal(first.sender.origin, origin)
    assert.equal(first.sender.url, origin + '/a')
    const before = await probe(mode === 'native' ? { tabId, documentId } : { tabId, frameId })
    assert.equal(before.url, origin + '/a')
    assert.equal(before.sender.id, id)
    assert.equal(before.sender.url, worker.url())
    assert.equal(before.sender.origin, 'chrome-extension://' + id)
    assert.equal(before.sender.tab, undefined)

    await worker.evaluate(() => globalThis.openPopup())
    const deadline = Date.now() + 10000
    let popup
    while (!popup && Date.now() < deadline) {
      popup = await worker.evaluate(() => globalThis.popupSender)
      if (!popup) await delay(50)
    }
    assert.equal(popup?.url, new URL('/popup.html', worker.url()).href)

    assert.equal(popup.id, id)
    assert.equal(popup.origin, 'chrome-extension://' + id)
    assert.equal(popup.tab, undefined)

    await frame.goto(origin + '/b')
    const second = await identity(frame)
    assert.equal(second.sender.frameId, frameId)
    assert.equal(second.sender.tab.id, tabId)
    assert.notEqual(second.sender.documentId, documentId)
    let stale
    if (mode === 'native') {
      await assert.rejects(probe({ tabId, documentId }), e => { stale = e.message; return true })
      assert.equal(await frame.evaluate(() => document.documentElement.dataset.calls), undefined)
      assert.equal((await probe({ tabId, documentId: second.sender.documentId })).url, origin + '/b')
    } else {
      // JS boundary control: the published frame adapter ignores this extra field.
      stale = await probe({ tabId, frameId, documentId })
      assert.equal(stale.url, origin + '/b')
    }
    assert.equal((await probe({ tabId, frameId })).url, origin + '/b')
    assert.equal(first.boot, second.boot)
    const stopped = await stopWorker(page, worker.url())
    await frame.goto(origin + '/wake')
    const wake = await identity(frame)
    assert.notEqual(wake.boot, second.boot)
    assert.equal(wake.sender.url, origin + '/wake')
    return { mode, browser: context.browser().version(), main, first, second, popup,
      workerSenderAtContent: before.sender, stale, stopped, wake }
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
  try {
    const results = []
    for (const mode of ['native', 'library']) {
      results.push(await trial(mode, 'http://127.0.0.1:' + server.address().port))
      fs.writeFileSync('observations.json', JSON.stringify(results, null, 2))
      console.log('PASS', mode, results.at(-1).browser)
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
