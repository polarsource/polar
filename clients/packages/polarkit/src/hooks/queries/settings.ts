import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { OrganizationBadgeSettingsRead, Platforms } from '../../api/client'
import { defaultRetry } from './retry'

export const useBadgeSettings: (
  platform: Platforms,
  orgName: string,
) => UseQueryResult<OrganizationBadgeSettingsRead, Error> = (
  platform: Platforms,
  orgName: string,
) =>
  useQuery({
    queryKey: ['organizationBadgeSettings'],
    queryFn: () =>
      api.organizations.getBadgeSettings({
        platform: platform,
        orgName: orgName,
      }),
    retry: defaultRetry,
  })
