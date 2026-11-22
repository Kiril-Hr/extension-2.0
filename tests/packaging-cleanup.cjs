const assert = require('assert/strict')
const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const library = path.join(root, 'devxtension')
const output = path.join(root, 'reports/cleanup-2026-11-16')
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')

fs.mkdirSync(output, { recursive: true })

const result = cp.spawnSync(process.execPath, [npm, 'pack', '--dry-run', '--json'], {
  cwd: library,
  encoding: 'utf8',
  timeout: 300000
})
fs.writeFileSync(path.join(output, 'npm-pack-dry-run.stdout.log'), result.stdout || '')
fs.writeFileSync(path.join(output, 'npm-pack-dry-run.stderr.log'), result.stderr || '')
assert.equal(result.status, 0, result.stderr)

// npm lifecycle scripts can write before the JSON result. Preserve that raw
// output separately and parse the actual JSON array without hiding failures.
const start = result.stdout.search(/^\s*\[/m)
assert(start >= 0, 'npm pack did not return its JSON file list')
const packages = JSON.parse(result.stdout.slice(start))
assert.equal(packages.length, 1)

const packed = packages[0]
const files = packed.files.map(file => file.path)
assert.equal(packed.version, '1.1.0')

for (const file of files) {
  assert(file.startsWith('dist/') || ['README.md', 'LICENSE', 'package.json'].includes(file), 'Unexpected package file: ' + file)
  assert(!file.startsWith('dist/test/'), 'Author fixtures must stay out of npm')
  assert(!file.endsWith('/integration-test.cjs'), 'VM test helper must stay out of npm')
  assert(!/(?:^|\/)(?:\.env|\.npmrc|\.idea|node_modules)(?:[/.]|$)/.test(file), 'Sensitive/unintended package path: ' + file)

  if (!file.endsWith('.map')) continue

  const map = JSON.parse(fs.readFileSync(path.join(library, file), 'utf8'))
  assert(map.sources.every(source => !/^(?:[a-z]:|\/)/i.test(source)), 'Absolute source-map path: ' + file)
}

for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/devex-scripts/index.js', 'README.md', 'LICENSE']) {
  assert(files.includes(file), 'Required package file missing: ' + file)
}

const cli = packed.files.find(file => file.path === 'dist/devex-scripts/index.js')
assert(cli.mode & 0o444, 'npm CLI binary must be readable in the tarball')
assert(/^#! ?\/usr\/bin\/env node\n/.test(fs.readFileSync(path.join(library, cli.path), 'utf8')), 'CLI needs its LF shebang')

const consumer = path.join(root, '.verification/factory-consumer')
const installed = JSON.parse(fs.readFileSync(path.join(consumer, 'node_modules/devxtension/package.json'), 'utf8'))
assert.equal(installed.bin['devex-scripts'].replace(/^\.\//, ''), 'dist/devex-scripts/index.js')

const binary = cp.spawnSync(process.execPath, [npm, 'exec', '--no', '--', 'devex-scripts', '__cleanup_invalid_command__'], {
  cwd: consumer,
  encoding: 'utf8',
  timeout: 30000
})
assert.equal(binary.status, 1, 'Installed CLI must reject unknown commands')
assert(/Unknown|unknown/.test(binary.stdout + binary.stderr), 'Installed npm binary was not executed')

fs.writeFileSync(path.join(output, 'npm-pack-dry-run.json'), JSON.stringify(packages, null, 2))
fs.writeFileSync(path.join(output, 'npm-pack-files.txt'), files.join('\n') + '\n')
console.log(`PASS npm whitelist, installed CLI executable behavior (archive mode ${cli.mode}), LF shebang, relative source maps and metadata (${files.length} files)`)
