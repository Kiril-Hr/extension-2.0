const observedURLs = {}
let previousUrl = window.location.href;

// Function for observing changes URL and checking needed module (script)
function checkUrlChange() {
    const currentUrl = window.location.href;

    // Check out whether current URL has changed
    if (currentUrl !== previousUrl) {
        // Check out whether URL according new URL
        if (observedURLs[currentUrl]) {
            // Reload extension and use new module
            chrome.runtime.reload();
        }
        // Update old URL
        previousUrl = currentUrl;
    }
}

// Adding event processor for observing changing URL
chrome.webNavigation.onHistoryStateUpdated.addListener(checkUrlChange);