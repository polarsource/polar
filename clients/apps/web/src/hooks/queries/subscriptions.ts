import {
  ListResourceSubscription,
  Subscription,
  SubscriptionsApiListRequest,
  SubscriptionUpdate,
} from '@polar-sh/api'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

export const useListSubscriptions = (
  organizationId?: string,
  parameters?: Omit<SubscriptionsApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['subscriptions', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.subscriptions.list({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useSubscription = (id: string, initialData?: Subscription) =>
  useQuery({
    queryKey: ['subscriptions', { id }],
    queryFn: () => api.subscriptions.get({ id }),
    retry: defaultRetry,
    initialData,
  })

export const useUpdateSubscription = (id: string) =>
  useMutation({
    mutationFn: (body: SubscriptionUpdate) => {
      return api.subscriptions.update({ id, body })
    },
    onSuccess: (result, _variables, _ctx) => {
      queryClient.setQueriesData(
        {
          queryKey: ['subscriptions', { id }],
        },
        result,
      )
      queryClient.setQueriesData<ListResourceSubscription>(
        {
          queryKey: [
            'subscriptions',
            { organizationId: result.product.organization_id },
          ],
        },
        (old) => {
          if (!old) {
            return {
              items: [result],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: old.items.map((item) =>
                item.id === result.id ? result : item,
              ),
              pagination: old.pagination,
            }
          }
        },
      )
    },
  })
