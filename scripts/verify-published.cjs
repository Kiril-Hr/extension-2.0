const fs = require('fs')
const os = require('os')
const path = require('path')
const cp = require('child_process')
const assert = require('assert/strict')

const root = path.resolve(__dirname, '..')
const pkg = require('../devxtension/package.json')
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'devex-published-'))
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')

function run(args) {
  const result = cp.spawnSync(process.execPath, args, {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 300000
  })

  assert.equal(result.status, 0, `Command failed: ${args.join(' ')}`)
}

fs.cpSync(path.join(root, '.verification/factory-consumer/src'), path.join(consumer, 'src'), { recursive: true })
fs.copyFileSync(path.join(root, '.verification/factory-consumer/tsconfig.json'), path.join(consumer, 'tsconfig.json'))
fs.writeFileSync(path.join(consumer, '.env'), '')
fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
  name: 'devex-published-verification',
  version: '1.0.0',
  private: true
}))

run([npm, 'install', '--registry=https://registry.npmjs.org/', '--no-audit', '--no-fund', `${pkg.name}@${pkg.version}`])

const installed = require(path.join(consumer, 'node_modules/devxtension/package.json'))
assert.equal(installed.version, pkg.version)
run([path.join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit'])
run([path.join(root, 'tests/factory-types.cjs')])
run([path.join(consumer, 'node_modules/devxtension/dist/devex-scripts/index.js'), 'build'])

const manifest = JSON.parse(fs.readFileSync(path.join(consumer, 'dist/manifest.json'), 'utf8'))
assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.name, 'DevEx author factory')
console.log(`Verified public ${pkg.name}@${pkg.version} in ${consumer}`)
