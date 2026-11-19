import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

export const useCheckoutLink = (
  organizationId: string | undefined,
  id: string | undefined,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['checkout_link', organizationId, { id }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/checkout-links/{id}', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    enabled: !!organizationId && !!id,
  })
}

export const useInfiniteCheckoutLinks = (
  organizationId: string | undefined,
  params?: Omit<
    operations['checkout-links:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useInfiniteQuery({
    queryKey: ['infinite', 'checkout_links', organizationId, { ...params }],
    queryFn: ({ pageParam = 1 }) =>
      unwrap(
        polar.GET('/v1/checkout-links/', {
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
