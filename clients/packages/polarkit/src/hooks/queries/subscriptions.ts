import {
  ListResourceSubscriptionTier,
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Platforms,
  SubscriptionBenefitCreate,
  SubscriptionBenefitUpdate,
  SubscriptionTier,
  SubscriptionTierBenefit,
  SubscriptionTierBenefitsUpdate,
  SubscriptionTierCreate,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { UseQueryResult, useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useSubscriptionTiers = (
  orgName: string,
  platform: Platforms = Platforms.GITHUB,
): UseQueryResult<ListResourceSubscriptionTier, Error> =>
  useQuery({
    queryKey: ['subscriptionTiers', 'organization', orgName],
    queryFn: () =>
      api.subscriptions.searchSubscriptionTiers({
        organizationName: orgName,
        platform,
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

export const useUpdateSubscriptionTier = () =>
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
      updateSubscriptionTiersCache(result)

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization'],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits'],
      })
    },
  })

export const useCreateSubscriptionTier = () =>
  useMutation({
    mutationFn: (subscriptionTierCreate: SubscriptionTierCreate) => {
      return api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate,
      })
    },
    onSuccess: (result, variables, ctx) => {
      updateSubscriptionTiersCache(result)

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization'],
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

export const useUpdateSubscriptionBenefit = () =>
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
      updateSubscriptionBenefitsCache(result)

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'organization'],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers'],
      })
    },
  })

export const useUpdateSubscriptionTierBenefits = () =>
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
      updateSubscriptionTiersCache(result)

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers', 'organization'],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits'],
      })
    },
  })

export const useCreateSubscriptionBenefit = () =>
  useMutation({
    mutationFn: (subscriptionBenefitCreate: SubscriptionBenefitCreate) => {
      return api.subscriptions.createSubscriptionBenefit({
        subscriptionBenefitCreate,
      })
    },
    onSuccess: (result, variables, ctx) => {
      updateSubscriptionBenefitsCache(result)

      queryClient.invalidateQueries({
        queryKey: ['subscriptionBenefits', 'organization'],
      })

      queryClient.invalidateQueries({
        queryKey: ['subscriptionTiers'],
      })
    },
  })

const updateSubscriptionTiersCache = (result: SubscriptionTier) => {
  queryClient.setQueriesData<ListResourceSubscriptionTier>(
    {
      queryKey: ['subscriptionTiers', 'id', result.id],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items?.map((i) => {
          if (i.id === result.id) {
            return {
              ...i,
              issue: result,
            }
          }
          return { ...i }
        }),
      }
    },
  )
}

const updateSubscriptionBenefitsCache = (result: SubscriptionTierBenefit) => {
  queryClient.setQueriesData<ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom>(
    {
      queryKey: ['subscriptionBenefits', 'id', result.id],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items?.map((i) => {
          if (i.id === result.id) {
            return {
              ...i,
              issue: result,
            }
          }
          return { ...i }
        }),
      }
    },
  )
}
