import { usePolarClient } from '@/providers/PolarClientProvider'
import { unwrap } from '@polar-sh/client'
import * as Sentry from '@sentry/react-native'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOrganizations = (
  {
    enabled = true,
  }: {
    enabled?: boolean
  } = { enabled: true },
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      try {
        return await unwrap(
          polar.GET('/v1/organizations/', {
            params: {
              query: {
                limit: 100,
              },
            },
          }),
        )
      } catch (error) {
        Sentry.captureException(error, {
          tags: { context: 'useOrganizations' },
        })
        throw error
      }
    },
    enabled,
  })
}

export const useDeleteOrganization = () => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { data, error } = await polar.DELETE('/v1/organizations/{id}', {
        params: { path: { id: organizationId } },
      })
      return { data, error }
    },
  })
}
