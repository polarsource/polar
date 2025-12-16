import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

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

export const useCheckoutLinks = (
  organizationId: string | undefined,
  params?: Omit<
    operations['checkout-links:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['checkout_links', organizationId, { ...params }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/checkout-links/', {
          params: {
            query: {
              organization_id: organizationId,
              ...params,
            },
          },
        }),
      ),
    enabled: !!organizationId,
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

export const useCheckoutLinkUpdate = (
  organizationId: string | undefined,
  id: string,
) => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: (data: schemas['CheckoutLinkUpdate']) =>
      unwrap(
        polar.PATCH('/v1/checkout-links/{id}', {
          params: { path: { id } },
          body: data,
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['checkout_link', organizationId, { id }], data)

      queryClient.invalidateQueries({
        queryKey: ['checkout_links', organizationId],
      })

      queryClient.invalidateQueries({
        queryKey: ['infinite', 'checkout_links', organizationId],
      })
    },
  })
}
