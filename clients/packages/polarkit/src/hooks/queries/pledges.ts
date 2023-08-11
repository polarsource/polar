import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Platforms } from '../../api/client'
import { defaultRetry } from './retry'

export const useListPersonalPledges = () =>
  useQuery(['listPersonalPledges'], () => api.pledges.listPersonalPledges(), {
    retry: defaultRetry,
  })

export const useGetPledge = (
  platform: Platforms,
  orgName: string,
  repoName: string,
  number: number,
  pledgeId: string | undefined,
) =>
  useQuery(
    ['pledge', pledgeId],
    () =>
      api.pledges.getPledge({
        platform,
        orgName,
        repoName,
        number,
        pledgeId: pledgeId || '',
      }),
    {
      enabled: !!pledgeId,
      retry: defaultRetry,
    },
  )

export const useListPledgesForOrganization = (
  platform?: Platforms,
  orgName?: string,
) =>
  useQuery(
    ['pledge', 'list', platform, orgName],
    () =>
      api.pledges.search({
        platform: platform || Platforms.GITHUB,
        organizationName: orgName || '',
      }),
    {
      retry: defaultRetry,
      enabled: !!platform && !!orgName,
    },
  )
