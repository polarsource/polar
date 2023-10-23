import { Configuration, PolarAPI } from '@polar-sh/sdk'
import { getValidationErrorsMap } from './errors'
import { getServerURL } from './url'

export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
export { queryClient } from './query'
export { getServerURL }
export { getValidationErrorsMap }

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
