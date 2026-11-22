const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const pkg = require('../packages/runtime/package.json')
const registry = 'https://registry.npmjs.org/devxtension'

function one(directory, predicate) {
  const files = fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && predicate(entry.name))
  assert.equal(files.length, 1, 'Expected exactly one matching artifact in ' + directory)
  return path.join(files[0].parentPath, files[0].name)
}

async function main(input, output) {
  assert(input && output, 'Provide an artifact directory and output directory or --require-unpublished')
  const publish = output === '--require-unpublished'
  const archive = one(input, name => name.endsWith('.tgz'))
  const provenance = JSON.parse(fs.readFileSync(one(input, name => name === 'candidate-provenance.json'), 'utf8'))
  const expectedFiles = fs.readFileSync(one(input, name => name === 'npm-pack-files.txt'), 'utf8')
    .trim().split(/\r?\n/).sort()
  const bytes = fs.readFileSync(archive)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(sha256, provenance.sha256, 'Archive differs from the tested candidate')
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), provenance.integrity)

  const list = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
  assert(list.every(file => file.startsWith('package/')), 'Unexpected archive layout')
  const files = list.map(file => file.slice('package/'.length)).sort()
  assert.deepEqual(files, expectedFiles, 'Actual archive inventory differs from verified pack inventory')
  const metadata = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }))
  assert.deepEqual(metadata, pkg)
  assert.equal(metadata.name, 'devxtension')
  assert.equal(metadata.repository.directory, 'packages/runtime')

  const response = await fetch(registry, { signal: AbortSignal.timeout(30000) })
  assert(response.ok, `npm registry version check failed (HTTP ${response.status})`)
  const published = await response.json()
  assert.equal(published.name, pkg.name)
  assert(published.versions && typeof published.versions === 'object', 'Invalid npm registry version list')
  const alreadyPublished = Object.hasOwn(published.versions, pkg.version)
  console.log(`${pkg.name}@${pkg.version}: ${files.length} files, SHA-256 ${sha256}; registry version ${alreadyPublished ? 'already published' : 'available'}`)

  if (publish) {
    assert(!alreadyPublished, `Refusing to publish existing ${pkg.name}@${pkg.version}`)
    return
  }

  fs.mkdirSync(output, { recursive: true })
  fs.copyFileSync(archive, path.join(output, 'devxtension.tgz'))
  fs.writeFileSync(path.join(output, 'candidate-provenance.json'), JSON.stringify({ ...provenance, alreadyPublished }, null, 2))
  fs.writeFileSync(path.join(output, 'npm-pack-files.txt'), files.join('\n') + '\n')
}

main(process.argv[2], process.argv[3]).catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
