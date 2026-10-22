import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCatalogs = (organizationId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['catalogs', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/catalogs/', {
          params: { query: { organization_id: organizationId, limit: 100 } },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
