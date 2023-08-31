import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Platforms, PledgeRead } from '../../api/client'
import { defaultRetry } from './retry'

export const useListPersonalPledges: () => UseQueryResult<
  PledgeRead[],
  Error
> = () =>
  useQuery({
    queryKey: ['listPersonalPledges'],
    queryFn: () => api.pledges.listPersonalPledges(),
    retry: defaultRetry,
  })

export const useGetPledge = (pledgeId?: string) =>
  useQuery({
    queryKey: ['pledge', pledgeId],
    queryFn: () =>
      api.pledges.get({
        id: pledgeId || '',
      }),
    enabled: !!pledgeId,
    retry: defaultRetry,
  })

export const useListPledesForIssue = (issueId?: string) =>
  useQuery({
    queryKey: ['pledge', 'byIssue', issueId],
    queryFn: () =>
      api.pledges.search({
        issueId: issueId || '',
      }),

    enabled: !!issueId,
    retry: defaultRetry,
  })

export const useListPledgesForOrganization = (
  platform?: Platforms,
  orgName?: string,
) =>
  useQuery({
    queryKey: ['pledge', 'list', platform, orgName],
    queryFn: () =>
      api.pledges.search({
        platform: platform || Platforms.GITHUB,
        organizationName: orgName || '',
      }),

    retry: defaultRetry,
    enabled: !!platform && !!orgName,
  })
