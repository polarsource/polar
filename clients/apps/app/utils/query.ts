export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientResponseError, isValidationError } from '@polar-sh/client'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // With SSR, we usually want to set some default staleTime
      // above 0 to avoid refetching immediately on the client
      staleTime: 60 * 1000,
      // gcTime needs to be _higher_ than maxAge in any persisted clients
      // see https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient
      gcTime: 1000 * 60 * 60, // 1 hour
      throwOnError: true,
      retry: (failureCount, error) => {
        if (
          error instanceof ClientResponseError &&
          error.response.status > 400 &&
          error.response.status < 500
        ) {
          return false
        }

        if (isValidationError(error)) {
          return false
        }

        if (failureCount >= 3) {
          return false
        }

        return true
      },
    },
  },
})
