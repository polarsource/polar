export const abbrStars = (stars: number): string => {
  if (stars < 1000) {
    return stars.toString()
  }

  stars /= 1000
  return stars.toFixed(1) + 'k'
}

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
