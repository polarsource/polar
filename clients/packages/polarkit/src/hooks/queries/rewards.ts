import { ListResourceReward } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useListRewards: (
  pledgesToOrganization?: string,
) => UseQueryResult<ListResourceReward, Error> = (
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
