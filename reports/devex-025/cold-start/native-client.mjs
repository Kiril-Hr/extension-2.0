export function identify() {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 5000)
    chrome.runtime.sendMessage({ name: 'identify' }, response => {
      clearTimeout(timer)
      resolve(chrome.runtime.lastError ? { ok: false, code: 'channelClosed' } : response || { code: 'missing' })
    })
  })
}
