const RELOAD_KEY = 'polar:stale-chunk-reload'

export const reloadOnStaleChunk = (error: Error) => {
  if (!error.message.includes('module factory is not available')) return false
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}
