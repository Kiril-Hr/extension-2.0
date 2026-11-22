// Diagnostic for the CI-pinned Playwright and real headless Chromium.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')

const root = path.resolve(__dirname, '../..')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.verification/browser-binaries')
const { chromium } = require(process.env.DEVEX_PLAYWRIGHT_PATH || path.join(root, '.verification/tools/node_modules/playwright'))

async function waitUntil(read, description, timeout) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const result = await read()
    if (result) return result

    await delay(250)
  }

  throw new Error('Timed out waiting for ' + description)
}

async function main() {
  const extension = path.join(root, 'examples/minimal/dist')
  const profileDir = path.join(root, '.verification/browser-profile')
  fs.mkdirSync(profileDir, { recursive: true })
  const profile = fs.mkdtempSync(path.join(profileDir, 'idle-'))

  // Attaching a debugger at startup can change the lifetime being measured.
  const child = spawn(chromium.executablePath(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--disable-extensions-except=' + extension, '--load-extension=' + extension, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true })

  let browser
  try {
    const portFile = path.join(profile, 'DevToolsActivePort')
    const port = await waitUntil(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(), 'debug port', 15000)
    const endpoint = 'http://127.0.0.1:' + port
    const workers = async () => {
      const targets = await (await fetch(endpoint + '/json/list')).json()
      return targets.filter(t => t.type === 'service_worker' && t.url.endsWith('/background.js'))
    }

    const workerUrl = await waitUntil(async () => (await workers())[0]?.url, 'initial extension worker', 15000)
    await waitUntil(async () => (await workers()).length === 0, 'natural worker suspension', 90000)

    browser = await chromium.connectOverCDP(endpoint)
    const context = browser.contexts()[0]
    const page = await context.newPage()
    await page.route('https://example.com/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>DevEx idle worker check</title><body></body>'
    }))
    await page.goto('https://example.com/')
    await page.waitForSelector('#devex-hello')
    assert.equal(context.serviceWorkers().length, 0)

    if (process.argv.includes('--passive-first')) {
      await assert.rejects(context.waitForEvent('serviceworker', { timeout: 30000 }), { name: 'TimeoutError' })
      console.log('Reproduced the original passive 30-second timeout after successful injection.')
    }

    await page.evaluate(() => {
      window.prior = document.getElementById('devex-hello')
      history.pushState({}, '', '/second')
    })
    await page.waitForFunction(() => {
      const node = document.getElementById('devex-hello')
      return window.prior && node && window.prior !== node
    })
    assert.equal(await page.locator('#devex-hello').count(), 1)

    const worker = context.serviceWorkers().find(w => w.url() === workerUrl) ||
      await context.waitForEvent('serviceworker', w => w.url() === workerUrl)
    assert.equal(await worker.evaluate(() => chrome.webNavigation.onHistoryStateUpdated.hasListeners()), true)
    console.log('PASS', browser.version(), 'dormant worker woke on pushState, replaced one node in the same document, and had the navigation listener.')
  } finally {
    try {
      await browser?.close()
    } finally {
      child.kill()
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
