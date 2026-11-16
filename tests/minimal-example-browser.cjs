const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.verification/browser-binaries')

const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH || path.join(root, '.verification/tools/node_modules/playwright'))
const output = path.join(root, 'reports/cleanup-2026-11-16')
const extension = path.join(root, 'examples/minimal/dist')

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'))
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual(manifest.host_permissions, ['https://example.com/*'])
  assert.deepEqual(manifest.permissions, ['webNavigation'])

  const context = await chromium.launchPersistentContext(path.join(root, '.verification/browser-profile/minimal'), {
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

    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
    assert.equal(await worker.evaluate(() => chrome.webNavigation.onHistoryStateUpdated.hasListeners()), true)

    await page.evaluate(() => {
      window.__sameDocument = true
      window.__initialHello = document.getElementById('devex-hello')
      history.pushState({}, '', '/second')
    })
    await page.waitForFunction(() => document.getElementById('devex-hello') && window.__initialHello !== document.getElementById('devex-hello'))
    assert.equal(await page.locator('#devex-hello').count(), 1)
    assert.equal(await page.evaluate(() => window.__sameDocument), true)
    assert.deepEqual(errors, [])

    fs.mkdirSync(output, { recursive: true })
    fs.writeFileSync(path.join(output, 'minimal-browser.json'), JSON.stringify({
      status: 'PASS',
      browser: context.browser().version(),
      note: 'Only the example.com document is served deterministically through Playwright routing; DevEx, DI, Chrome injection and navigation are real.',
      checks: ['scoped MV3 permissions', 'public npm example injects real module', 'SPA navigation keeps one element and the same document', 'no page errors']
    }, null, 2))
  } finally {
    await context.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
