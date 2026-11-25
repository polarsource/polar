import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

export const useSearch = (organizationId: string, query: string) =>
  useQuery({
    queryKey: ['search', { organizationId, query }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/search', {
          params: {
            query: { organization_id: organizationId, query, limit: 5 },
          },
        }),
      ),
    retry: false,
    placeholderData: keepPreviousData,
    enabled: !!query,
  })
