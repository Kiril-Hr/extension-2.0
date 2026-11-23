const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

assert(process.env.DEVEX_SOURCE_ROOT, 'DEVEX_SOURCE_ROOT is required for candidate verification')
const { sourceRoot } = require('./source-package.cjs')
const root = path.resolve(__dirname, '..')
const expected = fs.realpathSync(path.join(root, 'packages/runtime'))
assert.equal(fs.realpathSync(sourceRoot), expected, 'Candidate verification must select packages/runtime')

const artifactRoot = path.join(root, '.verification/tools/runtime-runs')
fs.mkdirSync(artifactRoot, { recursive: true })
const scratch = fs.mkdtempSync(path.join(artifactRoot, 'run-'))
const output = path.join(scratch, 'reports/factory-api-audit-2026-10-30')
const minimal = path.join(scratch, 'examples/minimal')
const consumer = path.join(scratch, '.verification/factory-consumer')
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const env = { ...process.env, DEVEX_SOURCE_ROOT: expected }
const steps = []

fs.mkdirSync(output, { recursive: true })
fs.mkdirSync(consumer, { recursive: true })
fs.mkdirSync(minimal, { recursive: true })
fs.cpSync(__dirname, path.join(scratch, 'tests'), { recursive: true, filter: file => file === __dirname || file.endsWith('.cjs') })

function run(name, args, cwd = scratch) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', timeout: 300000, maxBuffer: 20000000 })
  const log = (result.stdout || '') + (result.stderr || '') + (result.error ? String(result.error) : '')
  fs.writeFileSync(path.join(output, name + '.log'), log)
  steps.push({ name, exitCode: result.status, signal: result.signal })
  fs.writeFileSync(path.join(output, 'stage-2a-steps.json'), JSON.stringify({ sourceRoot: expected, steps }, null, 2))
  assert.equal(result.status, 0, log)
  console.log('PASS', name)
}

run('candidate-npm-ci', [npm, 'ci', '--no-audit', '--no-fund'], expected)
run('candidate-product', ['tests/factory-product.cjs'])
run('candidate-packaging', ['tests/packaging-cleanup.cjs'])

const runtime = require(path.join(expected, 'package.json'))
const archive = path.join(output, runtime.name + '-' + runtime.version + '.tgz')
const bytes = fs.readFileSync(archive)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64')
const minimalSource = path.join(root, 'examples/minimal')
fs.cpSync(path.join(minimalSource, 'src'), path.join(minimal, 'src'), { recursive: true })
fs.copyFileSync(path.join(minimalSource, 'tsconfig.json'), path.join(minimal, 'tsconfig.json'))
fs.copyFileSync(path.join(minimalSource, '.env.example'), path.join(minimal, '.env'))

const pkg = require(path.join(minimalSource, 'package.json'))
pkg.dependencies.devxtension = 'file:' + archive.replaceAll('\\', '/')
fs.writeFileSync(path.join(minimal, 'package.json'), JSON.stringify(pkg, null, 2))
run('candidate-minimal-install', [npm, 'install', '--no-audit', '--no-fund'], minimal)

for (const directory of [consumer, minimal]) {
  const locked = require(path.join(directory, 'package-lock.json')).packages['node_modules/devxtension']
  const installed = require(path.join(directory, 'node_modules/devxtension/package.json'))
  assert.equal(locked.integrity, integrity)
  assert.match(locked.resolved, /^file:/)
  assert.equal(installed.repository.directory, 'packages/runtime')
}

fs.writeFileSync(path.join(output, 'candidate-provenance.json'), JSON.stringify({ sourceRoot: expected, sha256, integrity }, null, 2))
console.log('Candidate tarball SHA-256:', sha256)
run('candidate-minimal-types', [npm, 'run', 'typecheck'], minimal)
run('candidate-minimal-build', [npm, 'run', 'build'], minimal)
run('candidate-watch', ['tests/factory-watch.cjs'])
env.DEVEX_PACKAGE_PATH = archive
env.DEVEX_CONSUMER_PATH = consumer
run('candidate-factory-chromium', ['tests/factory-browser.cjs'])
run('candidate-minimal-chromium', ['tests/minimal-example-browser.cjs'])
run('candidate-dev-reload', ['tests/dev-reload.cjs', minimal])
