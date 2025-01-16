import { api } from '@/utils/api'
import { ListResourceReward } from '@polar-sh/api'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
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
