import { api } from '@/utils/api'
import { OrdersApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<OrdersApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['orders', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.orders.list({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
