import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useSearch = (organizationId: string, query: string) =>
  useQuery({
    queryKey: ['search', organizationId, query],
    queryFn: () =>
      unwrap(
        api.GET('/v1/search', {
          params: {
            query: { organization_id: organizationId, query, limit: 5 },
          },
        }),
      ),
    retry: false,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === organizationId ? previousData : undefined,
    enabled: !!query,
  })
