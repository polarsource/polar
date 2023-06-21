import { QueryClient } from '@tanstack/react-query'
import { CancelablePromise, PolarAPI } from './client'
export { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const queryClient = new QueryClient()

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const api = new PolarAPI({
  BASE: getServerURL(),
  WITH_CREDENTIALS: true,
})

export { CancelablePromise }
