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
