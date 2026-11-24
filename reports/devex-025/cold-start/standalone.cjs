const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { setTimeout: delay } = require('node:timers/promises')

// The page may trigger one fixed, null-payload probe only on this loopback fixture.
exports.page = `<!doctype html><title>Standalone probe</title><script>
const id = new URL(location.href).searchParams.get('trial')
let started = false
const observe = () => {
  if (!document.documentElement.dataset.probe) return
  const state = document.documentElement.dataset.probe
  navigator.sendBeacon('/client/' + id, state)
  if (started) return
  started = true
  document.dispatchEvent(new Event('cold-start-probe'))
}
new MutationObserver(observe).observe(document.documentElement, { attributes: true, attributeFilter: ['data-probe'] })
observe()
</script>`

exports.run = async function ({ scratch, origin, binary, output, clients, observations, startLoad, cpu }) {
  const fd = fs.openSync(output, 'wx')
  try {
    for (let id = 0; id < 8; id++) {
      const fixture = (id + Math.floor(id / 4)) % 2 ? 'typed' : 'native'
      const load = Boolean(id % 4 < 2)
      const row = { id, fixture, load, worker: [], host: {} }
      clients.set(String(id), row)
      observations.set(String(id), row.worker)
      const directory = path.join(scratch, fixture)
      fs.writeFileSync(path.join(directory, 'worker.js'), 'self.mark = stage => { void fetch(' +
        JSON.stringify(origin + '/trace/' + id) + ', { method: "POST", body: JSON.stringify({ stage, local: Date.now() }) })' +
        '.catch(() => {}) }\nmark("evaluate")\nimportScripts("implementation.js")\n')

      const profile = fs.mkdtempSync(path.join(scratch, 'profile-'))
      let stop = await startLoad(load)
      const initial = cpu()
      row.host.launch = Date.now()
      const child = spawn(binary, [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
        '--user-data-dir=' + profile, '--disable-extensions-except=' + directory, '--load-extension=' + directory,
        origin + '/?trial=' + id
      ], { windowsHide: true, stdio: 'ignore' })
      const exited = once(child, 'exit')
      try {
        const end = Date.now() + 45000
        while (!row.client?.result && Date.now() < end && child.exitCode === null) await delay(25)
        if (!row.client?.result) row.error = 'Initial page did not report settlement'
        if (row.client?.result === 'timeout') {
          await delay(id < 4 ? 3000 : 18000)
          row.host.loadRelease = Date.now()
          await stop()
          stop = async () => {}
          await delay(10000)
        }
        if (row.client?.sends !== 1) row.error ||= 'Expected one native submission'
      } finally {
        row.host.observed = Date.now()
        const final = cpu()
        row.cpuPct = Math.round(100 * (1 - (final.idle - initial.idle) / (final.total - initial.total)))
        await stop()
        child.kill()
        await exited
        clients.delete(String(id))
        observations.delete(String(id))
        fs.writeSync(fd, JSON.stringify(row) + '\n')
        console.log(id, fixture, load, row.client?.result, row.error || '')
      }
    }
  } finally {
    fs.closeSync(fd)
  }
}
