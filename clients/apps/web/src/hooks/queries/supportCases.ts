import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSupportCases = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<
      operations['support-cases:list_support_cases']['parameters']['query']
    >,
    'organization_id'
  >,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['supportCases', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/support-cases/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
