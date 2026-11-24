globalThis.legacyCalls = (globalThis.legacyCalls || 0) + 1
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message === 'legacy') respond(globalThis.legacyCalls)
})
