import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

export const useOrder = (id: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['orders', { id }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/orders/{id}', {
          params: {
            path: { id },
          },
        }),
      ),
  })
}

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<
    operations['orders:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useInfiniteQuery({
    queryKey: ['orders', { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam = 1 }) =>
      unwrap(
        polar.GET('/v1/orders/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              page: pageParam,
            },
          },
        }),
      ),
    enabled: !!organizationId,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.items.length === 0) return undefined
      return pages.length + 1
    },
  })
}
