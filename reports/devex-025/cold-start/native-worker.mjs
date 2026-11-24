chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.name !== 'identify' || sender.id !== chrome.runtime.id || sender.origin !== ORIGIN) return false
  mark('handler')
  respond({ ok: true, value: 'identified' })
  return false
})
mark('registered')
