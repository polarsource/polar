import { api } from '@/utils/api'
import { Order, OrdersApiListRequest } from '@polar-sh/api'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrder = (id: string, initialData?: Order) =>
  useQuery({
    queryKey: ['orders', { id }],
    queryFn: () => api.orders.get({ id }),
    retry: defaultRetry,
    initialData,
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
