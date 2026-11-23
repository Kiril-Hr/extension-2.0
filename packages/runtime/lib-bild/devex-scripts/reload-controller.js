const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const openChromium = require('./chromium')

module.exports = function createReloadController(options) {
  let browser
  let directory
  let previousFiles = []
  let closed = false
  let active = Promise.resolve()

  async function reload(output, files) {
    if (closed) return
    if (!directory) directory = fs.mkdtempSync(path.join(os.tmpdir(), 'devex-extension-'))

    // Chromium reads only successful builds from this session-owned directory.
    for (const file of previousFiles.filter(file => !files.includes(file))) fs.unlinkSync(path.join(directory, file))
    for (const file of files) {
      const target = path.join(directory, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(path.join(output, file), target)
    }
    previousFiles = files

    browser ||= await openChromium(options)
    if (closed) return

    await browser.reload(directory)
    console.log('[DevEx] Reload complete')
  }

  return {
    update(output, files) {
      active = active.then(() => reload(output, files))
      return active
    },
    async close() {
      closed = true
      try {
        await active
      } finally {
        try {
          await browser?.close()
        } finally {
          if (directory) fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
        }
      }
    }
  }
}
