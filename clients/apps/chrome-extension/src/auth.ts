console.log('STARTING')
window.addEventListener('load', function () {
  console.log('LOADED')
  const interval = setInterval(async function () {
    const tokenElem = document.getElementById('polar-token')
    console.log('FOUND ELEM', tokenElem)
    if (tokenElem && tokenElem.innerText) {
      clearInterval(interval)
      await chrome.storage.local.set({ token: tokenElem.innerText })
      console.log('CLOSING WINDOW')
      window.close()
    }
  }, 1000)
})

export {}
