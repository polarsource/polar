export { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { isServer, QueryClient } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
        // gcTime needs to be _higher_ than maxAge in any persisted clients
        // see https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient
        gcTime: 1000 * 60 * 60, // 1 hour
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }

    return browserQueryClient
  }
}
