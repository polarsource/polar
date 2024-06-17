import { SubscriptionsApiListSubscriptionsRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useListSubscriptions = (
  organizationId?: string,
  parameters?: Omit<
    SubscriptionsApiListSubscriptionsRequest,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['subscriptions', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.subscriptions.listSubscriptions({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
