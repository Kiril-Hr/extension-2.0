const fs = require('fs')
const os = require('os')
const path = require('path')
const cp = require('child_process')
const assert = require('assert/strict')

const root = path.resolve(__dirname, '..')
const pkg = require('../devxtension/package.json')
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'devex-published-'))
const nodeDirectory = path.dirname(process.execPath)
const npm = [
  path.join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'),
  path.resolve(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js')
].find(file => fs.existsSync(file))

assert(npm, 'Cannot locate npm CLI beside the active Node installation')

function run(args) {
  const result = cp.spawnSync(process.execPath, args, {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 300000
  })

  assert.equal(result.status, 0, `Command failed: ${args.join(' ')}`)
}

async function waitForRegistry() {
  const deadline = Date.now() + 300000
  const specification = `${pkg.name}@${pkg.version}`

  while (true) {
    const result = cp.spawnSync(process.execPath, [npm, 'view', specification, 'version', '--json', '--prefer-online', '--registry=https://registry.npmjs.org/'], {
      cwd: consumer,
      encoding: 'utf8',
      timeout: 30000
    })

    if (result.status === 0) {
      assert.equal(JSON.parse(result.stdout), pkg.version)
      return
    }

    const unavailable = /E404|ETARGET/.test(result.stderr || '')
    assert(unavailable && Date.now() < deadline, result.stderr || String(result.error))
    console.log(`Waiting for public registry availability: ${specification}`)

    await new Promise(resolve => setTimeout(resolve, 10000))
  }
}

async function main() {
  await waitForRegistry()

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
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
