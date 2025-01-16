import {
  ListResourceSubscription,
  SubscriptionCancel,
  SubscriptionsApiListRequest,
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

export const useCancelSubscription = () =>
  useMutation({
    mutationFn: (variables: { id: string; body: SubscriptionCancel }) => {
      return api.subscriptions.update(variables)
    },
    onSuccess: (result, _variables, _ctx) => {
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
