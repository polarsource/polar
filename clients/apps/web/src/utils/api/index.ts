export const getServerURL = (path?: string): string => {
  path = path || ''
  // In browser context, always use the public URL
  if (typeof window !== 'undefined') {
    return `${process.env.NEXT_PUBLIC_API_URL}${path}`
  }
  // In server context, prefer internal URL for container-to-container communication
  const baseURL = process.env.POLAR_API_URL || process.env.NEXT_PUBLIC_API_URL
  return `${baseURL}${path}`
}

// For browser-facing URLs (auth redirects, props to client components)
export const getPublicServerURL = (path?: string): string => {
  path = path || ''
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
  return `${baseURL}${path}`
}
