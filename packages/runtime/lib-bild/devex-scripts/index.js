#!/usr/bin/env node
const [task, ...args] = process.argv.slice(2)

if (task === 'dev') {
  require('./dev')(args).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
} else if (task === 'build') {
  const result = require('cross-spawn').sync(process.execPath, [
    require.resolve('webpack-cli/bin/cli.js'), '--config', require.resolve('../config/webpack.prod')
  ], { stdio: 'inherit' })

  if (result.error) console.error(result.error)
  process.exitCode = result.status ?? 1
} else {
  console.error(`Unknown script "${task}". Use dev or build.`)
  process.exitCode = 1
}
