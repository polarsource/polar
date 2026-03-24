import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const SUBSCRIPTION_TIMELINE_EVENT_NAMES = [
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.revoked',
  'order.paid',
  'order.refunded',
] as const

const subscriptionTimelineQuery = (
  organizationId: string,
  customerId: string,
) => ({
  organization_id: organizationId,
  customer_id: [customerId],
  source: 'system' as const,
  name: SUBSCRIPTION_TIMELINE_EVENT_NAMES as unknown as string[],
})

export const useInfiniteSubscriptionTimeline = (
  organizationId: string,
  customerId: string,
) =>
  useInfiniteQuery({
    queryKey: ['subscriptions', customerId, 'timeline', 'infinite'],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: {
              ...subscriptionTimelineQuery(organizationId, customerId),
              page: pageParam,
            },
          },
        }),
      ),
    retry: defaultRetry,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const pagination = lastPage.pagination
      if (lastPage.items.length === 0) return null
      if ('max_page' in pagination && lastPageParam === pagination.max_page)
        return null
      if ('has_next_page' in pagination && !pagination.has_next_page)
        return null
      return lastPageParam + 1
    },
    enabled: !!customerId && !!organizationId,
  })

export const useSubscriptionTimeline = (
  organizationId: string,
  customerId: string,
  limit: number = 10,
) =>
  useQuery({
    queryKey: ['subscriptions', customerId, 'timeline', { limit }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: {
              ...subscriptionTimelineQuery(organizationId, customerId),
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!customerId && !!organizationId,
  })

export const useSubscriptions = (
  organizationId?: string,
  parameters?: Omit<
    NonNullable<operations['subscriptions:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['subscriptions', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/subscriptions/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useSubscription = (
  id: string,
  initialData?: schemas['Subscription'],
) =>
  useQuery({
    queryKey: ['subscriptions', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/subscriptions/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
  })

export const useSubscriptionChargePreview = (id: string) =>
  useQuery({
    queryKey: ['subscriptions', { id }, 'charge-preview'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/subscriptions/{id}/charge-preview', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
  })

export const useUpdateSubscription = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['SubscriptionUpdate']) => {
      return api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.setQueriesData<schemas['Subscription']>(
        {
          queryKey: ['subscriptions', { id }],
        },
        data,
      )
      queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
        {
          queryKey: [
            'subscriptions',
            { organizationId: data.product.organization_id },
          ],
        },
        (old) => {
          if (!old) {
            return {
              items: [data],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: old.items.map((item) =>
                item.id === data.id ? data : item,
              ),
              pagination: old.pagination,
            }
          }
        },
      )

      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'charge-preview'],
      })
    },
  })

export const useUncancelSubscription = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          cancel_at_period_end: false,
        },
      })
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.setQueriesData<schemas['Subscription']>(
        {
          queryKey: ['subscriptions', { id }],
        },
        data,
      )
      queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
        {
          queryKey: [
            'subscriptions',
            { organizationId: data.product.organization_id },
          ],
        },
        (old) => {
          if (!old) {
            return {
              items: [data],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: old.items.map((item) =>
                item.id === data.id ? data : item,
              ),
              pagination: old.pagination,
            }
          }
        },
      )

      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'charge-preview'],
      })
    },
  })
