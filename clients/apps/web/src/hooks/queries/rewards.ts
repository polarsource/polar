import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListRewards = (pledgesToOrganization?: string) =>
  useQuery({
    queryKey: ['rewards', 'list', pledgesToOrganization],
    queryFn: () =>
      unwrap(
        api.GET('/v1/rewards/search', {
          params: { query: { pledges_to_organization: pledgesToOrganization } },
        }),
      ),

    retry: defaultRetry,
    enabled: !!pledgesToOrganization,
  })

export const useListRewardsToUser = (userId?: string) =>
  useQuery({
    queryKey: ['rewards', 'list', userId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/rewards/search', {
          params: { query: { rewards_to_user: userId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!userId,
  })
