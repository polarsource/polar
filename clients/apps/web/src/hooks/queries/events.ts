import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useEvents = (organizationId: string, customerId?: string) => {
  return useInfiniteQuery({
    queryKey: ['events', { organizationId, customerId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: { organization_id: organizationId, customer_id: customerId },
          },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPageParam === lastPage.pagination.max_page ? null : lastPageParam + 1,
    retry: defaultRetry,
  })
}
