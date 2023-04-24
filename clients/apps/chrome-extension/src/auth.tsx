window.addEventListener('load', function () {
  const interval = setInterval(async function () {
    const tokenElem = document.getElementById('polar-token')
    if (tokenElem && tokenElem.innerText) {
      alert('FOUND TOKEN ' + tokenElem.innerText)
      clearInterval(interval)
      await chrome.storage.local.set({ token: tokenElem.innerText })
      window.close()
    }
  }, 1000)
})

export {}
