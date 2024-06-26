import { SubscriptionsApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
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
