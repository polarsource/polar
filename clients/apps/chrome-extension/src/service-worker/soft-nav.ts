// Reload content scripts on navigation to any of the pages that matches the original
// content script matches

// This makes sure that the extension is loaded when navigating to the issues pages
// from other pages when navigating in the SPA.
const contentListener = (e) => {
  console.log('Navigating on GitHub, reloading content script', {
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

// This makes sure that we pick up the auth token even if we're redirected back to
// the page after authenticating with GitHub.
const authListener = (e) => {
  console.log('Navigating to the token page, reloading content script', {
    to: e.url,
    tabId: e.tabId,
  })

  chrome.scripting
    .executeScript({
      files: ['auth.js'],
      target: { tabId: e.tabId },
    })
    .catch((e) => {
      console.error('Failed to re-execute auth.js', e)
    })
}

if (!chrome.webNavigation.onHistoryStateUpdated.hasListener(contentListener)) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(contentListener, {
    url: [{ urlMatches: 'https://github.com/(.+)/(.+)/issues' }],
  })
}

if (!chrome.webNavigation.onHistoryStateUpdated.hasListener(authListener)) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(authListener, {
    url: [{ pathEquals: '/settings/extension' }],
  })
}
