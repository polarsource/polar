export const prettyURL = (url: string): string => {
  if (url.indexOf('https://') === 0) {
    url = url.substring(8)
  }
  if (url.indexOf('http://') === 0) {
    url = url.substring(7)
  }
  if (url.endsWith('/')) {
    url = url.substring(0, url.length - 1)
  }
  return url
}

export const externalURL = (url: string): string => {
  if (url.startsWith('http://')) {
    return url
  }
  if (url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  if (url.startsWith('://')) {
    return `https${url}`
  }
  return `https://${url}`
}
