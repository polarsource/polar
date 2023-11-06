import {
  ListResourceSubscriptionTier,
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Platforms,
  SubscriptionBenefitCreate,
  SubscriptionBenefitUpdate,
  SubscriptionTier,
  SubscriptionTierBenefitsUpdate,
  SubscriptionTierCreate,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { UseQueryResult, useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '../../api'
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

export const useUpdateSubscriptionTier = (orgName?: string) =>
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
    onSuccess: (result, variables, ctx) => {
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
    onSuccess: (result, variables, ctx) => {
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
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'id', variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

export const useSubscriptionBenefits = (
  orgName: string,
  limit = 30,
  platform: Platforms = Platforms.GITHUB,
): UseQueryResult<
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Error
> =>
  useQuery({
    queryKey: ['subscriptionBenefits', 'organization', orgName],
    queryFn: () =>
      api.subscriptions.searchSubscriptionBenefits({
        organizationName: orgName,
        platform,
        limit,
      }),
    retry: defaultRetry,
  })

export const useSubscriptionBenefit = (id?: string) =>
  useQuery({
    queryKey: ['subscriptionBenefits', 'id', id],
    queryFn: () => {
      return api.subscriptions.lookupSubscriptionBenefit({
        subscriptionBenefitId: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateSubscriptionBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      subscriptionBenefitUpdate,
    }: {
      id: string
      subscriptionBenefitUpdate: SubscriptionBenefitUpdate
    }) => {
      return api.subscriptions.updateSubscriptionBenefit({
        id,
        subscriptionBenefitUpdate,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'id', result.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'organization', orgName],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers'],
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
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'id', result.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization', orgName],
      })
    },
  })

export const useCreateSubscriptionBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: (subscriptionBenefitCreate: SubscriptionBenefitCreate) => {
      return api.subscriptions.createSubscriptionBenefit({
        subscriptionBenefitCreate,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'id', result.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'organization', orgName],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers'],
      })
    },
  })

export const useDeleteSubscriptionBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.subscriptions.deleteSubscriptionBenefit({
        id,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'id', variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'organization', orgName],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers'],
      })
    },
  })

export const useUserSubscriptions = (
  userId: string,
  orgName: string,
  limit = 30,
  platform = Platforms.GITHUB,
) =>
  useQuery({
    queryKey: ['userSubscriptions', 'organization', orgName, userId],
    queryFn: () =>
      api.subscriptions.searchSubscriptions({
        organizationName: orgName,
        limit,
        platform,
        subscriberUserId: userId,
      }),
    retry: defaultRetry,
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
