import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { ListResource_Reward_ } from '../../api/client'
import { defaultRetry } from './retry'

export const useListRewards: (
  pledgesToOrganization?: string,
) => UseQueryResult<ListResource_Reward_, Error> = (
  pledgesToOrganization?: string,
) =>
  useQuery({
    queryKey: ['rewards', 'list', pledgesToOrganization],
    queryFn: () =>
      api.rewards.search({
        pledgesToOrganization: pledgesToOrganization,
      }),

    retry: defaultRetry,
    enabled: !!pledgesToOrganization,
  })

export const useListRewardsToUser = (userId?: string) =>
  useQuery({
    queryKey: ['rewards', 'list', userId],
    queryFn: () =>
      api.rewards.search({
        rewardsToUser: userId,
      }),
    retry: defaultRetry,
    enabled: !!userId,
  })
