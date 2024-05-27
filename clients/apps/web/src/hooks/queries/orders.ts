import { api } from '@/utils/api'
import { OrdersApiListOrdersRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<OrdersApiListOrdersRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['orders', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.orders.listOrders({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
