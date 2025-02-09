import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useExternalOrganizations = (
  parameters?: operations['external_organizations:list']['parameters']['query'],
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['externalOrganizations', { ...parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/external_organizations/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
