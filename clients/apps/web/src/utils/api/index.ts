import { Configuration, PolarAPI } from '@polar-sh/sdk'

export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
export { queryClient } from './query'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  let baseURL = process.env.NEXT_PUBLIC_API_URL

  if (isOnCustomDomain() && typeof window === 'object') {
    baseURL = window.location.origin
  }

  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const isOnCustomDomain = () => {
  if (typeof window === 'undefined') {
    // Custom domains does not matter on the server
    return false
  }

  // On the default origin
  if (window.location.origin === process.env.NEXT_PUBLIC_FRONTEND_BASE_URL) {
    return false
  }

  return true
}

export const api = new PolarAPI(
  new Configuration({
    basePath: getServerURL(),
    credentials: 'include',
  }),
)

export const buildAPI = (opts: { token?: string }) =>
  new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      accessToken: opts.token,
    }),
  )
