import { api } from '@/utils/client'
import { operations, unwrap } from '@spaire/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCheckouts = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['checkouts:list']['parameters']['query']>,
    'organization_id'
  >,
) => {
  return useQuery({
    queryKey: ['checkouts', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/checkouts/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
}
