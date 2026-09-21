import { isServer, QueryClient } from '@tanstack/react-query'

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })

let browserQueryClient: QueryClient | undefined

/** One client per browser tab; a fresh one per request on the server. */
export const getQueryClient = () => {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
