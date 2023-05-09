// Reload content_script on navigation to any of the pages that matches the original content script matches
//
// This makes sure that the extension is loaded when navigating to the issues pages from other pages when navigating
// in the SPA.

const listener = (e) => {
  console.log('Navigating on GitHub, reloading content_script', {
    to: e.url,
    tabId: e.tabId,
  })

  chrome.scripting
    .executeScript({
      files: ['content.js'],
      target: { tabId: e.tabId },
    })
    .catch((e) => {
      console.error('Failed to re-execute content.js', e)
    })
}

if (!chrome.webNavigation.onHistoryStateUpdated.hasListener(listener)) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(listener, {
    url: [{ urlMatches: 'https://github.com/(.+)/(.+)/issues' }],
  })
}
