import { useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useListRewards = (pledgesToOrganization?: string) =>
  useQuery(
    ['rewards', 'list', pledgesToOrganization],
    () =>
      api.rewards.search({
        pledgesToOrganization: pledgesToOrganization,
      }),
    {
      retry: defaultRetry,
      enabled: !!pledgesToOrganization,
    },
  )

export const useListRewardsToUser = (userId?: string) =>
  useQuery(
    ['rewards', 'list', userId],
    () =>
      api.rewards.search({
        rewardsToUser: userId,
      }),
    {
      retry: defaultRetry,
      enabled: !!userId,
    },
  )
