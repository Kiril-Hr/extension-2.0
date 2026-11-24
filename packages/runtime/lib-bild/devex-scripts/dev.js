const readline = require('node:readline')
const { parseArgs } = require('node:util')
const webpack = require('webpack')
const config = require('../config/webpack.dev')

module.exports = async function watch(args) {
  const { values } = parseArgs({ args, options: {
    url: { type: 'string', default: 'about:blank' },
    headless: { type: 'boolean' },
    'watch-only': { type: 'boolean' }
  } })
  if (values.url !== 'about:blank' && !['http:', 'https:'].includes(new URL(values.url).protocol)) {
    throw Error('--url expects an HTTP or HTTPS test page')
  }

  const compiler = webpack(config)
  const shutdown = new AbortController()
  let closing = false
  let stop
  const stopped = new Promise(resolve => { stop = resolve })
  const requestStop = () => {
    closing = true
    shutdown.abort()
    stop()
  }
  const controller = values['watch-only'] ? undefined : require('./reload-controller')({
    headless: !!values.headless, url: values.url, onClose: requestStop, signal: shutdown.signal
  })

  const input = readline.createInterface({ input: process.stdin })
  input.on('line', line => { if (line.trim() === 'q') requestStop() })
  input.on('SIGINT', requestStop)
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const signal of signals) process.once(signal, requestStop)

  compiler.hooks.done.tapPromise('DevExReload', async stats => {
    console.log(stats.toString({ preset: 'errors-warnings', colors: false }))
    if (closing || stats.hasErrors() || !controller) return

    // The manifest generator writes directly to the output directory.
    const files = ['manifest.json', ...stats.compilation.getAssets().map(asset => asset.name)]
    await controller.update(config.output.path, files)
  })

  const watcher = compiler.watch({}, error => {
    if (!error || closing) return

    console.error('[DevEx]', error.message)
    process.exitCode = 1
    requestStop()
  })

  console.log('[DevEx] Watching. Type q and Enter or press Ctrl+C to stop.')
  try {
    await stopped
  } finally {
    input.close()
    process.stdin.pause()
    try {
      await new Promise((resolve, reject) => watcher.close(error => error ? reject(error) : resolve()))
    } finally {
      try {
        await controller?.close()
      } finally {
        await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()))
        for (const signal of signals) process.removeListener(signal, requestStop)
      }
    }
  }
}
