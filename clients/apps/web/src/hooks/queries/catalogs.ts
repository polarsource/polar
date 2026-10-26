import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCatalogs = (organizationId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['catalogs', { organizationId }],
    queryFn: async () => {
      const catalogs: schemas['Catalog'][] = []
      let page = 1
      while (true) {
        const data = await unwrap(
          api.GET('/v1/catalogs/', {
            params: {
              query: {
                organization_id: organizationId,
                status: ['live', 'archived'],
                page,
                limit: 100,
              },
            },
          }),
        )
        catalogs.push(...data.items)
        if (page >= data.pagination.max_page) {
          return catalogs
        }
        page++
      }
    },
    retry: defaultRetry,
    enabled,
  })
