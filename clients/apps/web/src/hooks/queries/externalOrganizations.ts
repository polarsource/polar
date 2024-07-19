import { api } from '@/utils/api'
import { ExternalOrganizationsApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useExternalOrganizations = (
  parameters?: ExternalOrganizationsApiListRequest,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['externalOrganizations', { ...parameters }],
    queryFn: () =>
      api.externalOrganizations.list({
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled,
  })
