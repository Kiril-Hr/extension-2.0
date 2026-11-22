const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const dir = process.argv[2]
const manifest = JSON.parse(fs.readFileSync(dir + '/manifest.json', 'utf8'))
assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.background.service_worker, 'background.js')
assert.deepEqual(manifest.content_scripts[0].matches, ['https://example.com/*'])

let callback
let receiver = false
const reloads = []
const messages = []
const chrome = {
  webNavigation: { onHistoryStateUpdated: { addListener: fn => { callback = fn } } },
  tabs: {
    reload: id => reloads.push(id),
    sendMessage(id, message, respond) {
      messages.push({ id, type: message.type })
      if (!receiver) chrome.runtime.lastError = { message: 'No receiver' }
      respond(receiver ? { handled: true } : undefined)
      delete chrome.runtime.lastError
    }
  },
  runtime: {}
}

vm.runInNewContext(fs.readFileSync(dir + '/background.js', 'utf8'), { chrome, URL })
callback({ tabId: 7, frameId: 0, url: 'https://example.com/one' })
callback({ tabId: 8, frameId: 0, url: 'https://example.com.evil.org/one' })
callback({ tabId: 9, frameId: 1, url: 'https://example.com/one' })
receiver = true
callback({ tabId: 10, frameId: 0, url: 'https://example.com/two' })
assert.deepEqual(reloads, [7])
assert.deepEqual(messages, [7, 8, 10].map(id => ({ id, type: '__DEVEX_ROUTE_CHANGED__' })))
console.log('PASS generated MV3 background navigation, frame filter and fallback')
