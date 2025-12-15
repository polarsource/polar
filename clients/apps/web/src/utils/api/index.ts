export const getServerURL = (path?: string): string => {
  path = path || ''
  // Use POLAR_API_URL for server-side requests (e.g., in Docker containers)
  // Fall back to NEXT_PUBLIC_API_URL for local development
  const baseURL = process.env.POLAR_API_URL || process.env.NEXT_PUBLIC_API_URL
  return `${baseURL}${path}`
}
