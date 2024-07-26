import { api, queryClient } from '@/utils/api'
import {
  PersonalAccessTokenCreate,
  UserAdvertisementCampaignCreate,
  UserAdvertisementCampaignUpdate,
  UserFreeSubscriptionCreate,
  UsersApiEnableAdvertisementCampaignRequest,
  UsersApiListAdvertisementCampaignsRequest,
  UsersApiListBenefitsRequest,
  UsersApiListOrdersRequest,
  UsersApiListSubscriptionsRequest,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePersonalAccessTokens = () =>
  useQuery({
    queryKey: ['personalAccessTokens'],
    queryFn: () => api.personalAccessToken.listPersonalAccessTokens(),
    retry: defaultRetry,
  })

export const useCreatePersonalAccessToken = () =>
  useMutation({
    mutationFn: (body: PersonalAccessTokenCreate) => {
      return api.personalAccessToken.createPersonalAccessToken({
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useDeletePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.personalAccessToken.deletePersonalAccessToken({
        id: variables.id,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useUserSubscriptions = (
  parameters: UsersApiListSubscriptionsRequest = {},
) =>
  useQuery({
    queryKey: ['user', 'subscriptions', parameters],
    queryFn: () => api.users.listSubscriptions(parameters),
    retry: defaultRetry,
  })

export const useCreateSubscription = () =>
  useMutation({
    mutationFn: (body: UserFreeSubscriptionCreate) => {
      return api.users.createSubscription({ body })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'subscriptions'],
      })
    },
  })

export const useUserOrders = (parameters: UsersApiListOrdersRequest = {}) =>
  useQuery({
    queryKey: ['user', 'orders', parameters],
    queryFn: () => api.users.listOrders(parameters),
    retry: defaultRetry,
  })

export const useUserOrderInvoice = () =>
  useMutation({
    mutationFn: (id: string) => {
      return api.users.getOrderInvoice({ id })
    },
  })

export const useCancelSubscription = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.users.cancelSubscription({ id })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'subscriptions'],
      })
    },
  })

export const useUserBenefits = (parameters: UsersApiListBenefitsRequest = {}) =>
  useQuery({
    queryKey: ['user', 'benefits', parameters],
    queryFn: () => api.users.listBenefits(parameters),
    retry: defaultRetry,
  })

export const useUserAdvertisementCampaigns = (
  parameters: UsersApiListAdvertisementCampaignsRequest = {},
) =>
  useQuery({
    queryKey: ['user', 'advertisementCampaigns', parameters],
    queryFn: () => api.users.listAdvertisementCampaigns(parameters),
    retry: defaultRetry,
  })

export const useUserCreateAdvertisementCampaign = () =>
  useMutation({
    mutationFn: (body: UserAdvertisementCampaignCreate) => {
      return api.users.createAdvertisementCampaign({
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'advertisementCampaigns'],
      })
    },
  })

export const useUserUpdateAdvertisementCampaign = (id: string) =>
  useMutation({
    mutationFn: (body: UserAdvertisementCampaignUpdate) => {
      return api.users.updateAdvertisementCampaign({
        id,
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'advertisementCampaigns'],
      })
    },
  })

export const useUserEnableAdvertisementCampaign = () =>
  useMutation({
    mutationFn: (
      requestParameters: UsersApiEnableAdvertisementCampaignRequest,
    ) => {
      return api.users.enableAdvertisementCampaign(requestParameters)
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'benefits'],
      })
    },
  })

export const useUserDeleteAdvertisementCampaign = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.users.deleteAdvertisementCampaign({
        id,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'advertisementCampaigns'],
      })
    },
  })
