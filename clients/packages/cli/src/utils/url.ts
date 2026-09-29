export const redactUrl = (value: string) => {
  const url = URL.parse(value)
  if (!url) return value
  if (url.username || url.password) {
    url.username = '***'
    url.password = ''
  }
  for (const key of new Set(url.searchParams.keys())) {
    url.searchParams.set(key, '***')
  }
  url.hash = ''
  return url.href
}
