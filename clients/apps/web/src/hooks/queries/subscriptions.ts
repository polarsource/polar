import { SubscriptionsApiListRequest, SubscriptionsApiCancelRequest } from '@polar-sh/sdk'
import { useQuery, useMutation } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

export const invalidateSubscriptionCache = (
  organizationId: string,
) => {
  queryClient.invalidateQueries({
    queryKey: ['subscriptions', organizationId],
  })
}

export const useListSubscriptions = (
  organizationId?: string,
  parameters?: Omit<SubscriptionsApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['subscriptions', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      api.subscriptions.list({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useCancelSubscription = (organizationId: string) =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      const response = api.subscriptions.cancel({
        id: variables.id
      })
      return response
    },
  })
