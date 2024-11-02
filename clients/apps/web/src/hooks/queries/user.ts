import { api, queryClient } from '@/utils/api'
import {
  PersonalAccessTokenCreate,
  UserAdvertisementCampaignCreate,
  UserAdvertisementCampaignUpdate,
  UserSubscriptionUpdate,
  UsersAdvertisementsApiEnableRequest,
  UsersAdvertisementsApiListRequest,
  UsersBenefitsApiListRequest,
  UsersLicenseKeysApiListRequest,
  UsersOrdersApiListRequest,
  UsersSubscriptionsApiListRequest,
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
  parameters: UsersSubscriptionsApiListRequest = {},
) =>
  useQuery({
    queryKey: ['user', 'subscriptions', parameters],
    queryFn: () => api.usersSubscriptions.list(parameters),
    retry: defaultRetry,
  })

export const useUserOrders = (parameters: UsersOrdersApiListRequest = {}) =>
  useQuery({
    queryKey: ['user', 'orders', parameters],
    queryFn: () => api.usersOrders.list(parameters),
    retry: defaultRetry,
  })

export const useUserOrderInvoice = () =>
  useMutation({
    mutationFn: (id: string) => {
      return api.usersOrders.invoice({ id })
    },
  })

export const useUpdateSubscription = () =>
  useMutation({
    mutationFn: (variables: { id: string; body: UserSubscriptionUpdate }) => {
      return api.usersSubscriptions.update({
        id: variables.id,
        body: variables.body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'subscriptions'],
      })
    },
  })

export const useCancelSubscription = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.usersSubscriptions.cancel({ id })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'subscriptions'],
      })
    },
  })

export const useUserBenefit = (id?: string) =>
  useQuery({
    queryKey: ['user', 'benefit', 'id', id],
    queryFn: () => api.usersBenefits.get({ id: id ?? '' }),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUserLicenseKeys = (
  parameters: UsersLicenseKeysApiListRequest = {},
) =>
  useQuery({
    queryKey: ['user', 'licenseKeys', parameters],
    queryFn: () => api.usersLicenseKeys.list(parameters),
    retry: defaultRetry,
  })

export const useUserBenefits = (parameters: UsersBenefitsApiListRequest = {}) =>
  useQuery({
    queryKey: ['user', 'benefits', parameters],
    queryFn: () => api.usersBenefits.list(parameters),
    retry: defaultRetry,
  })

export const useUserAdvertisementCampaigns = (
  parameters: UsersAdvertisementsApiListRequest = {},
) =>
  useQuery({
    queryKey: ['user', 'advertisementCampaigns', parameters],
    queryFn: () => api.usersAdvertisements.list(parameters),
    retry: defaultRetry,
  })

export const useUserCreateAdvertisementCampaign = () =>
  useMutation({
    mutationFn: (body: UserAdvertisementCampaignCreate) => {
      return api.usersAdvertisements.create({
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
      return api.usersAdvertisements.update({
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
    mutationFn: (requestParameters: UsersAdvertisementsApiEnableRequest) => {
      return api.usersAdvertisements.enable(requestParameters)
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
      return api.usersAdvertisements.delete({
        id,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'advertisementCampaigns'],
      })
    },
  })
