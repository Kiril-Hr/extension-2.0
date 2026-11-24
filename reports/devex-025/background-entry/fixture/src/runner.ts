import { createExtensionFactory } from 'devxtension'
import { protocol, realm } from './messaging/contract'

const manifest = {
  name: 'Background entry verification',
  version: '1.0.0' as const,
  description: 'Local Messaging fixture',
  action: { default_title: 'Background fixture' },
  permissions: [],
  host_permissions: [],
  content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['runner.js'] }]
}

createExtensionFactory([])({ params: { manifest } })

document.documentElement.dataset.contentRealm = realm
chrome.runtime.sendMessage('legacy', answer => {
  void chrome.runtime.lastError
  document.documentElement.dataset.legacy = String(answer || 0)
})
protocol.client('content').request('identify', 'hello', { role: 'background' }).then(result => {
  document.documentElement.dataset.answer = result.ok ? result.value : result.kind === 'messaging' ? result.code : 'domain'
})
