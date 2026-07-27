import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrganizationRoles = (organizationId: string | undefined) =>
  useQuery({
    queryKey: ['organizationRoles', organizationId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/roles', {
          params: { path: { id: organizationId ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

export type OrganizationPermission = schemas['OrganizationPermission']
