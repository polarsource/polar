import { api } from '@/utils/client'
import { operations, unwrap } from '@spaire/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomerMeters = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['customer_meters:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['customer_meters', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-meters/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
