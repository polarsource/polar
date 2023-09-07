import { CancelablePromise, PolarAPI } from './client'
import { getServerURL } from './url'
export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
export { queryClient } from './query'
export { CancelablePromise }
export { getServerURL }

export const api = new PolarAPI({
  BASE: getServerURL(),
  WITH_CREDENTIALS: true,
})

export const buildAPI = (opts: { token?: string }) =>
  new PolarAPI({
    BASE: getServerURL(),
    WITH_CREDENTIALS: true,
    TOKEN: opts.token,
  })
