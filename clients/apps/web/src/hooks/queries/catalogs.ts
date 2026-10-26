import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useLiveCatalog = (organizationId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['catalogs', 'live', { organizationId }],
    queryFn: async () => {
      const data = await unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organizationId,
              status: 'live',
              limit: 1,
            },
          },
        }),
      )
      return data.items[0] ?? null
    },
    retry: defaultRetry,
    enabled,
  })
