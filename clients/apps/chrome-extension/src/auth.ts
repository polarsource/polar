console.log('AUTH CONTENT SCRIPT')
window.addEventListener('load', function () {
  const interval = setInterval(async function () {
    console.log('LOOKING FOR TOKEN')
    const tokenElem = document.getElementById('polar-token')
    if (tokenElem && tokenElem.innerText) {
      console.log('FOUND IT')
      clearInterval(interval)
      await chrome.storage.local.set({ token: tokenElem.innerText })
      window.close()
    }
  }, 1000)
})

export {}
