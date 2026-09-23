export const isAllowedEmbedOrigin = (
  origin: string,
  embedHosts: string[],
): boolean => {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  if (origin !== url.origin) return false
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
  ) {
    return false
  }

  return embedHosts.some((entry) => {
    if (entry.includes('://')) return false

    const wildcard = entry.startsWith('*.')
    const host = wildcard ? entry.slice(2) : entry
    try {
      const allowed = new URL(`${url.protocol}//${host}`)
      if (url.port !== allowed.port) return false
      return wildcard
        ? url.hostname.endsWith(`.${allowed.hostname}`)
        : url.hostname === allowed.hostname
    } catch {
      return false
    }
  })
}
