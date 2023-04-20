window.addEventListener('load', function () {
  const interval = setInterval(function () {
    const tokenElem = document.getElementById('polar-token')
    if (tokenElem && tokenElem.innerText) {
      alert('FOUND TOKEN ' + tokenElem.innerText)
      clearInterval(interval)
      chrome.storage.local.set({ token: tokenElem.innerText })
    }
  }, 1000)
})

export {}
