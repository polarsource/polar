import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, unwrap } from '@polar-sh/client'
import { useInfiniteQuery } from '@tanstack/react-query'

export const useInfiniteDiscounts = (
  organizationId: string | undefined,
  params?: Omit<
    operations['discounts:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useInfiniteQuery({
    queryKey: ['infinite', 'discounts', organizationId, { ...params }],
    queryFn: ({ pageParam = 1 }) =>
      unwrap(
        polar.GET('/v1/discounts/', {
          params: {
            query: {
              organization_id: organizationId,
              ...params,
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
