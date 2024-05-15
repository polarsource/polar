import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

export const useUserSubscriptions = (
  userId?: string,
  orgName?: string,
  limit = 30,
  platform = Platforms.GITHUB,
) =>
  useQuery({
    queryKey: ['userSubscriptions', 'organization', orgName, userId],
    queryFn: () =>
      api.subscriptions.searchSubscribedSubscriptions({
        organizationName: orgName,
        limit,
        platform,
        subscriberUserId: userId,
      }),
    retry: defaultRetry,
    enabled: !!userId,
  })

export const useCreateFreeSubscription = () =>
  useMutation({
    mutationFn: ({
      tier_id,
      customer_email,
    }: {
      tier_id: string
      customer_email?: string
    }) => {
      return api.subscriptions.createFreeSubscription({
        freeSubscriptionCreate: {
          tier_id: tier_id,
          customer_email: customer_email,
        },
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['userSubscriptions'],
      })
    },
  })

export const useOrganizationSubscriptions = (
  subscriberOrganizationId?: string,
  orgName?: string,
  limit = 30,
  platform = Platforms.GITHUB,
) =>
  useQuery({
    queryKey: [
      'organizationSubscriptions',
      'organization',
      orgName,
      subscriberOrganizationId,
    ],
    queryFn: () =>
      api.subscriptions.searchSubscribedSubscriptions({
        organizationName: orgName,
        limit,
        platform,
        subscriberOrganizationId,
      }),
    retry: defaultRetry,
    enabled: !!subscriberOrganizationId,
  })

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

export const useSubscriptionSummary = (
  orgName: string,
  limit = 20,
  platform = Platforms.GITHUB,
) =>
  useQuery({
    queryKey: ['subscriptionSummary', 'organization', orgName],
    queryFn: () =>
      api.subscriptions.searchSubscriptionsSummary({
        organizationName: orgName,
        platform,
        limit,
      }),
    retry: defaultRetry,
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
