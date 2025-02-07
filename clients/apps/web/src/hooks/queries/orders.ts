import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrder = (
  id: string,
  initialData?: components['schemas']['Order'],
) =>
  useQuery({
    queryKey: ['orders', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/orders/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
  })

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<
    operations['orders:list']['parameters']['query'],
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['orders', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/orders/', {
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
