const fs = require('node:fs')
const assert = require('node:assert/strict')

const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line))
const groups = new Map()
function percentiles(values) {
  if (!values.length) return '—'
  values.sort((a, b) => a - b)
  return [0.5, 0.95].map(q => values[Math.ceil(q * values.length) - 1]).join('/')
}

for (const row of rows) {
  const key = [row.browser, row.fixture, row.activated ? 'activated' : 'cold', row.load ? 'CPU' : 'quiet',
    row.trace ? 'traced' : 'plain', row.differential ? (row.exclude ? 'excluded' : 'default') : ''].filter(Boolean).join(' | ')
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(row)
  if (row.client) assert.equal(row.client.sends, 1, 'Expected one native send in trial ' + row.id)
}

console.log('browser | fixture | start | load | observer | n | success | timeout | setup/error | success ms p50/p95 | host CPU % p50/p95')
for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const success = group.filter(r => r.client?.result === 'success')
  const timeout = group.filter(r => r.client?.result === 'timeout')
  const other = group.length - success.length - timeout.length
  console.log([key, group.length, success.length, timeout.length, other,
    percentiles(success.map(r => r.client.settle - r.client.submit)), percentiles(group.map(r => r.cpuPct))].join(' | '))
}
