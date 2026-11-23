const assert = require('assert/strict')
const { on } = require('node:events')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.verification/browser-binaries')

const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH || path.join(root, '.verification/tools/node_modules/playwright'))
const output = path.join(root, 'reports/cleanup-2026-11-16')
const extension = path.join(root, 'examples/minimal/dist')

async function verifyWorkerRegistration(page, script, stopWorker = false) {
  const session = await page.context().newCDPSession(page)
  const updates = on(session, 'ServiceWorker.workerVersionUpdated', { signal: AbortSignal.timeout(30000) })

  try {
    // Enabling CDP sends the current versions, followed by registration changes.
    await session.send('ServiceWorker.enable')
    let stoppedVersion
    for await (const [{ versions }] of updates) {
      const active = versions.find(({ status, scriptURL }) => status === 'activated' &&
        scriptURL.startsWith('chrome-extension://') && new URL(scriptURL).pathname === '/' + script)
      if (!active) continue

      if (!stopWorker || active.runningStatus === 'stopped') {
        return active.runningStatus
      }
      if (stoppedVersion === active.versionId) continue

      stoppedVersion = active.versionId
      await session.send('ServiceWorker.stopWorker', { versionId: active.versionId })
    }
  } finally {
    await updates.return()
    await session.detach()
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'))
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual(manifest.host_permissions, ['https://example.com/*'])
  assert.deepEqual(manifest.permissions, ['webNavigation'])

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  })

  try {
    const errors = []
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://example.com/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>DevEx minimal example check</title><body></body>'
    }))

    await page.goto('https://example.com/')
    await page.waitForSelector('#devex-hello')
    assert.equal(await page.locator('#devex-hello').textContent(), 'Hello from DevEx 2.0')

    const initialWorkerStatus = await verifyWorkerRegistration(page, manifest.background.service_worker)
    for (const route of ['/second', '/after-worker-stop']) {
      if (route === '/after-worker-stop') {
        assert.equal(await verifyWorkerRegistration(page, manifest.background.service_worker, true), 'stopped')
      }

      // pushState on a new path emits neither popstate nor hashchange. Replacing
      // the original node in this document requires the real background message.
      await page.evaluate(nextPath => {
        window.__sameDocument = true
        window.__initialHello = document.getElementById('devex-hello')
        history.pushState({}, '', nextPath)
      }, route)
      await page.waitForFunction(() => {
        const node = document.getElementById('devex-hello')
        return window.__sameDocument && node && node !== window.__initialHello
      }).catch(error => {
        throw new Error("Expected in-document reSetup on " + route + " after webNavigation", { cause: error })
      })
      assert.equal(await page.locator('#devex-hello').count(), 1)
      assert.equal(await page.locator('#devex-hello').textContent(), 'Hello from DevEx 2.0')
      assert.equal(new URL(page.url()).pathname, route)
    }
    assert.deepEqual(errors, [])

    fs.mkdirSync(output, { recursive: true })
    fs.writeFileSync(path.join(output, 'minimal-browser.json'), JSON.stringify({
      status: 'PASS',
      browser: context.browser().version(),
      initialWorkerStatus,
      beforeSecondNavigation: 'activated/stopped',
      note: 'Only the example.com document is served deterministically through Playwright routing; DevEx, DI, Chrome injection and navigation are real.',
      checks: ['scoped MV3 permissions', 'installed example injects real module', 'real webNavigation replaces the module node in the same document before and after stopping the worker', 'no page errors']
    }, null, 2))
    console.log('PASS minimal Chromium', context.browser().version(), initialWorkerStatus + ' -> stopped -> SPA reSetup')
  } finally {
    await context.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
