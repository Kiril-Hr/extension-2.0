const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { performance } = require('node:perf_hooks')
const { setTimeout: delay } = require('node:timers/promises')

async function waitForRegistry(npm, pkg, cwd, { run = spawnSync, now = () => performance.now(), sleep = delay } = {}) {
  const spec = `${pkg.name}@${pkg.version}`
  const deadline = now() + 300000
  const args = [npm, 'view', spec, 'version', '--json', '--prefer-online', '--fetch-retries=0', '--registry=https://registry.npmjs.org/']

  while (now() < deadline) {
    const timeout = Math.max(1, Math.min(30000, Math.ceil(deadline - now())))
    const result = run(process.execPath, args, { cwd, encoding: 'utf8', timeout })
    if (result.error) throw result.error

    if (result.status === 0) {
      assert.equal(JSON.parse(result.stdout), pkg.version, 'Registry returned an unexpected version')
      return
    }

    const stderr = result.stderr || ''
    if (!/^npm (?:error|ERR!) code (?:E404|ETARGET)\s*$/im.test(stderr)) {
      throw new Error(stderr.trim() || `npm view failed with status ${result.status}`)
    }

    const remaining = deadline - now()
    if (remaining <= 0) break

    console.log(`Waiting for ${spec} on the public npm registry`)
    await sleep(Math.min(10000, remaining))
  }

  throw new Error(`Timed out waiting for ${spec} after 5 minutes`)
}

module.exports = { waitForRegistry }
