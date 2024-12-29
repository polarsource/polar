import { api } from '@/utils/api'
import { OrdersApiGetRequest, OrdersApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrder = (
  orderId?: string,
  parameters?: Omit<OrdersApiGetRequest, 'id'>,
) =>
  useQuery({
    queryKey: ['order', orderId, parameters],
    queryFn: () => api.orders.get({ id: orderId ?? '', ...parameters }),
    retry: defaultRetry,
    enabled: !!orderId,
  })

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
