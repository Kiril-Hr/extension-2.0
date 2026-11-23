import { Sender, SenderPolicy } from './contract'

const index = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export function senderVerifier(policy: SenderPolicy) {
  const origins = new Set(policy.contentOrigins || [])
  for (const origin of origins) {
    const url = new URL(origin)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.origin !== origin || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) {
      throw new Error('Expected exact HTTPS or local development origin')
    }
  }

  const manifest = chrome.runtime.getManifest()
  const base = chrome.runtime.getURL('')
  const popup = policy.popupPath ?? manifest.action?.default_popup
  const worker = manifest.background && 'service_worker' in manifest.background ? manifest.background.service_worker : undefined
  const subframes = policy.allowSubframes === true
  const packaged = (path?: string) => {
    if (!path) return undefined
    const url = new URL(path, base)
    if (!url.href.startsWith(base)) throw new Error('Expected a packaged extension path')
    return url.href
  }
  const popupUrl = packaged(popup)
  const workerUrl = packaged(worker)
  if (popupUrl && popupUrl === workerUrl) throw new Error('Ambiguous extension role paths')

  return (metadata: chrome.runtime.MessageSender): Sender | undefined => {
    if (metadata.id !== chrome.runtime.id || !metadata.url || !metadata.origin) return
    let url: URL
    try {
      url = new URL(metadata.url)
    } catch {
      return
    }

    if (metadata.tab) {
      if (!origins.has(url.origin) || metadata.origin !== url.origin || !index(metadata.tab.id)
          || !index(metadata.frameId) || (!subframes && metadata.frameId !== 0)
          || typeof metadata.documentId !== 'string' || !metadata.documentId.length || metadata.documentId.length > 128) return

      return {
        role: 'content', tabId: metadata.tab.id, frameId: metadata.frameId,
        documentId: metadata.documentId, origin: url.origin
      }
    }

    if (metadata.origin !== base.slice(0, -1)) return
    if (url.href === popupUrl) return { role: 'popup', url: popupUrl }
    if (url.href === workerUrl) return { role: 'background', extensionId: metadata.id }
  }
}
