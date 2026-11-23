const fs = require('node:fs')
const path = require('node:path')
const webpack = require('webpack')

async function build(mode) {
  const output = path.resolve('dist', mode)
  const compiler = webpack({
    mode: 'production',
    devtool: false,
    entry: { worker: './worker.js', content: './content.js', popup: './popup.js' },
    resolve: { alias: { 'spike-transport$': path.resolve(mode + '.js') } },
    output: { path: output, filename: '[name].js' }
  })
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((e, s) => e ? reject(e) : resolve(s)))
    if (stats.hasErrors()) throw Error(stats.toString({ preset: 'errors-only' }))

    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({
      manifest_version: 3, name: 'DevEx messaging spike ' + mode, version: '1.0',
      action: { default_popup: 'popup.html' }, background: { service_worker: 'worker.js' },
      content_scripts: [{ matches: ['http://127.0.0.1/*'], all_frames: true, js: ['content.js'] }]
    }))
    fs.writeFileSync(path.join(output, 'popup.html'), '<!doctype html><title>Spike popup</title><script src="popup.js"></script>')
  } finally {
    await new Promise((resolve, reject) => compiler.close(e => e ? reject(e) : resolve()))
  }
}
build('native').then(() => build('library')).catch(e => { console.error(e); process.exitCode = 1 })
