export const getServerURL = (path?: string): string => {
  path = path || ''
  // In browser context, always use the public URL
  if (typeof window !== 'undefined') {
    return `${process.env.NEXT_PUBLIC_API_URL}${path}`
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
  const baseURL = process.env.NEXT_PUBLIC_API_URL
  return `${baseURL}${path}`
}
