const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

export const developmentApiURL = (
  baseURL: string | undefined,
  pageHostname?: string,
): string => {
  if (
    process.env.NODE_ENV === 'production' ||
    !baseURL ||
    !pageHostname ||
    !LOOPBACK_HOSTS.has(pageHostname)
  ) {
    return baseURL ?? ''
  }
  try {
    const url = new URL(baseURL)
    if (!LOOPBACK_HOSTS.has(url.hostname) || url.hostname === pageHostname) {
      return baseURL
    }
    url.hostname = pageHostname
    return url.toString().replace(/\/$/, '')
  } catch {
    return baseURL
  }
}

export const browserApiURL = (baseURL: string | undefined): string =>
  developmentApiURL(
    baseURL,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  )

export const getServerURL = (path?: string): string => {
  path = path || ''
  // In browser context, always use the public URL
  if (typeof window !== 'undefined') {
    return `${browserApiURL(process.env.NEXT_PUBLIC_API_URL)}${path}`
  }
  // In server context (SSR), use POLAR_API_URL if available (Docker dev only),
  // otherwise fall back to NEXT_PUBLIC_API_URL (Vercel/production)
  const baseURL = process.env.POLAR_API_URL || process.env.NEXT_PUBLIC_API_URL
  return `${baseURL}${path}`
}

// For URLs that will be used in the browser (auth redirects, props to client components).
// Always use NEXT_PUBLIC_API_URL since these URLs need to be accessible from the browser.
export const getPublicServerURL = (path?: string): string => {
  path = path || ''
  const baseURL = browserApiURL(process.env.NEXT_PUBLIC_API_URL)
  return `${baseURL}${path}`
}
