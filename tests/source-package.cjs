const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const configured = process.env.DEVEX_SOURCE_ROOT
const sourceRoot = configured === undefined
  ? path.resolve(__dirname, '../devxtension')
  : path.resolve(configured)

if (configured !== undefined) {
  assert(configured.trim(), 'DEVEX_SOURCE_ROOT must name a source package')
  for (const file of ['package.json', 'tsconfig.json', 'src/index.ts', 'lib-bild/devex-scripts/index.js']) {
    assert(fs.existsSync(path.join(sourceRoot, file)), `Invalid DEVEX_SOURCE_ROOT: missing ${file} in ${sourceRoot}`)
  }
  assert.equal(require(path.join(sourceRoot, 'package.json')).name, 'devxtension')
}

module.exports = { sourceRoot }
