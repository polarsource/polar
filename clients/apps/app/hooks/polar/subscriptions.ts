import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

export const useSubscription = (id: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['subscription', id],
    queryFn: () =>
      unwrap(polar.GET('/v1/subscriptions/{id}', { params: { path: { id } } })),
  })
}

export const useSubscriptions = (
  organizationId?: string,
  parameters?: Omit<
    operations['subscriptions:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useInfiniteQuery({
    queryKey: ['subscriptions', { organizationId, ...(parameters || {}) }],
    queryFn: async ({ pageParam = 1 }) =>
      unwrap(
        polar.GET('/v1/subscriptions/', {
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

export const useUpdateSubscription = (id: string) => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: (body: schemas['SubscriptionUpdate']) =>
      polar.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body,
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['subscription', id], data.data)

      queryClient.invalidateQueries({
        queryKey: ['subscriptions'],
      })
    },
  })
}
