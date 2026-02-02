import { api } from '@/utils/client'
import { operations, unwrap } from '@spaire/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePayments = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['payments:list']['parameters']['query']>,
    'organization_id'
  >,
) => {
  return useQuery({
    queryKey: ['payments', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/payments/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
}
