const assert = require('node:assert/strict')
const test = require('node:test')
const { waitForRegistry } = require('../scripts/wait-for-registry.cjs')

const pkg = { name: 'devxtension', version: '1.1.0' }
const failure = code => ({ status: 1, stderr: 'npm error code ' + code })

function scenario(reply) {
  let elapsed = 0
  let calls = 0
  const options = {
    now: () => elapsed,
    sleep: async ms => { elapsed += ms },
    run(command, args, { timeout }) {
      assert.equal(command, process.execPath)
      assert.ok(args.includes('devxtension@1.1.0'))
      assert.ok(timeout <= 300000 - elapsed)
      elapsed += Math.min(250, timeout)
      return reply(++calls)
    }
  }

  return { start: () => waitForRegistry('npm-cli.js', pkg, '.', options), elapsed: () => elapsed, calls: () => calls }
}

test('waits through E404 and ETARGET until the exact version is visible', async () => {
  const responses = [failure('E404'), failure('ETARGET'), { status: 0, stdout: '"1.1.0"' }]
  const probe = scenario(n => responses[n - 1])
  await probe.start()
  assert.equal(probe.calls(), 3)
  assert.equal(probe.elapsed(), 20750)
})

test('fails immediately on an auth error even if its message mentions ETARGET', async () => {
  const probe = scenario(() => ({ status: 1, stderr: 'npm error code E401\nETARGET mentioned in unrelated detail' }))
  await assert.rejects(probe.start(), /E401/)
  assert.equal(probe.calls(), 1)
})

test('exhausts the deadline without another request', async () => {
  const probe = scenario(() => failure('ETARGET'))
  await assert.rejects(probe.start(), /Timed out/)
  assert.equal(probe.elapsed(), 300000)
  assert.equal(probe.calls(), 30)
})

test('rejects a successful response for the wrong version', async () => {
  const probe = scenario(() => ({ status: 0, stdout: '"1.0.3"' }))
  await assert.rejects(probe.start(), /unexpected version/)
  assert.equal(probe.calls(), 1)
})
