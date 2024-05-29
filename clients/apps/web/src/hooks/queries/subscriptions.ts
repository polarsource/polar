import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useSearchSubscriptions = (variables: {
  organizationName: string
  platform: Platforms
  limit: number
  page: number
  sorting?: string[]
  subscriptionTierId?: string
  type?: SubscriptionTierType
  active?: boolean
}) =>
  useQuery({
    queryKey: ['subscriptions', 'search', JSON.stringify(variables)],
    queryFn: () =>
      api.subscriptions.searchSubscriptions({
        organizationName: variables.organizationName,
        platform: variables.platform,
        limit: variables.limit,
        page: variables.page,
        sorting: variables.sorting,
        subscriptionTierId: variables.subscriptionTierId,
        type: variables.type,
        active: variables.active,
      }),
    retry: defaultRetry,
    enabled: !!variables.organizationName && !!variables.platform,
  })

export const useSubscriptionStatistics = (variables: {
  orgName: string
  platform: Platforms
  startDate: Date
  endDate: Date
  tierTypes?: SubscriptionTierType[]
  subscriptionTierId?: string
}) =>
  useQuery({
    queryKey: ['subscriptionStatistics', JSON.stringify(variables)],
    queryFn: () =>
      api.subscriptions.getSubscriptionsStatistics({
        organizationName: variables.orgName,
        platform: variables.platform,
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
        types: variables.tierTypes,
        subscriptionTierId: variables.subscriptionTierId,
      }),
    retry: defaultRetry,
  })
