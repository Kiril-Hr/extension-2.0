export function listen(name, handle) {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.name !== name) return
    reply(handle(message.payload, sender))
  })
}
export function send(name, payload, target) {
  const message = { name, payload }
  if (!target) return chrome.runtime.sendMessage(message)
  const { tabId, ...options } = target
  return chrome.tabs.sendMessage(tabId, message, options)
}
