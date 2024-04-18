import {
  ListResourceSubscriptionTier,
  Platforms,
  SubscriptionTier,
  SubscriptionTierBenefitsUpdate,
  SubscriptionTierCreate,
  SubscriptionTierType,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

export const useSubscriptionTiers = (
  orgName: string,
  limit = 30,
  platform: Platforms = Platforms.GITHUB,
): UseQueryResult<ListResourceSubscriptionTier, Error> =>
  useQuery({
    queryKey: ['subscriptionTiers', 'organization', orgName],
    queryFn: () =>
      api.subscriptions.searchSubscriptionTiers({
        organizationName: orgName,
        platform,
        limit,
      }),
    retry: defaultRetry,
  })

export const useSubscriptionTier = (
  id?: string,
): UseQueryResult<SubscriptionTier, Error> =>
  useQuery({
    queryKey: ['subscriptionTiers', 'id', id],
    queryFn: () =>
      api.subscriptions.lookupSubscriptionTier({
        subscriptionTierId: id ?? '',
      }),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateSubscriptionTier: (orgName?: string) => UseMutationResult<
  SubscriptionTier,
  Error,
  {
    id: string
    subscriptionTierUpdate: SubscriptionTierUpdate
  },
  unknown
> = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      subscriptionTierUpdate,
    }: {
      id: string
      subscriptionTierUpdate: SubscriptionTierUpdate
    }) => {
      return api.subscriptions.updateSubscriptionTier({
        id,
        subscriptionTierUpdate,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'id', result.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

export const useCreateSubscriptionTier = (orgName?: string) =>
  useMutation({
    mutationFn: (subscriptionTierCreate: SubscriptionTierCreate) => {
      return api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

export const useArchiveSubscriptionTier = (orgName?: string) =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.subscriptions.archiveSubscriptionTier({
        id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'id', variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

export const useUpdateSubscriptionTierBenefits = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      subscriptionTierBenefitsUpdate,
    }: {
      id: string
      subscriptionTierBenefitsUpdate: SubscriptionTierBenefitsUpdate
    }) => {
      return api.subscriptions.updateSubscriptionTierBenefits({
        id,
        subscriptionTierBenefitsUpdate,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'id', result.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

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
