const { on } = require('node:events')
const { chromium } = require('playwright-core')

module.exports = async function openChromium({ headless, url, onClose, signal }) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    executablePath: process.env.DEVEX_CHROMIUM_PATH || undefined,
    headless,
    chromiumSandbox: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging']
  })

  try {
    const browser = context.browser()
    const session = await browser.newBrowserCDPSession()
    const { processInfo } = await session.send('SystemInfo.getProcessInfo')
    const page = context.pages()[0] || await context.newPage()
    let extensionId
    let workerVersion

    page.once('close', onClose)
    context.once('close', onClose)
    console.log(`[DevEx] Chromium ${browser.version()}, PID ${processInfo.find(p => p.type === 'browser').id}`)

    return {
      async reload(directory) {
        const lifecycle = await context.newCDPSession(page)
        const versions = on(lifecycle, 'ServiceWorker.workerVersionUpdated', {
          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])
        })

        try {
          await lifecycle.send('ServiceWorker.enable')
          const { id } = await session.send('Extensions.loadUnpacked', { path: directory })
          if (extensionId && id !== extensionId) throw Error('Unpacked extension ID changed during reload')

          // The command can return while the previous worker is still stopping.
          const script = `chrome-extension://${id}/background.js`
          for await (const [event] of versions) {
            const activated = event.versions.find(worker => worker.scriptURL === script &&
              worker.status === 'activated' && worker.versionId !== workerVersion)
            if (!activated) continue

            workerVersion = activated.versionId
            break
          }

          if (!extensionId) await page.goto(url, { waitUntil: 'domcontentloaded' })
          else await page.reload({ waitUntil: 'domcontentloaded' })

          extensionId = id
        } catch (error) {
          if (!signal.aborted) {
            if (error.name === 'AbortError') throw Error('Timed out waiting for the new MV3 background worker to activate')
            throw error
          }
        } finally {
          await versions.return()
          await lifecycle.detach().catch(error => { if (!signal.aborted) throw error })
        }
      },
      close: () => context.close()
    }
  } catch (error) {
    await context.close()
    throw error
  }
}
