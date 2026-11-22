// URL patterns are inserted by additionalUpdater at build time.
const observedURLs = {}
const observeGlobalRoutes = false

// Uses the compiled DevEx matcher, preserving its separate runtime semantics.
const matchesPattern = __DEVEX_RUNTIME_URL_MATCHER__

// MV3 background is a service worker: use event details, not window.location.
if (observeGlobalRoutes || Object.keys(observedURLs).length) chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId, url }) => {
    if (frameId !== 0 || tabId < 0) return
    // A live factory handles route changes without destroying its DI context.
    // If the initial page had no matching content script, reload only on entry
    // into a matched route so Chrome can perform the first injection.
    chrome.tabs.sendMessage(tabId, { type: '__DEVEX_ROUTE_CHANGED__', url }, response => {
        if (chrome.runtime.lastError && Object.keys(observedURLs).some(pattern => matchesPattern(pattern, url))) {
            chrome.tabs.reload(tabId)
        }
    })
})
