const interval = setInterval(async function () {
  const tokenElem = document.getElementById('polar-token')
  if (tokenElem && tokenElem.innerText) {
    clearInterval(interval)
    await chrome.storage.local.set({ token: tokenElem.innerText })
    window.close()
  }
}, 1000)

export {}
