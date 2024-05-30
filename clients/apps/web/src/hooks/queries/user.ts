import { api, queryClient } from '@/utils/api'
import {
  UserFreeSubscriptionCreate,
  UserRead,
  UserUpdateSettings,
  UsersApiListOrdersRequest,
  UsersApiListSubscriptionsRequest,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useUser: () => UseQueryResult<UserRead> = () =>
  useQuery({
    queryKey: ['user'],
    queryFn: () => api.users.getAuthenticated(),
    retry: defaultRetry,
  })

export const useUserPreferencesMutation: () => UseMutationResult<
  UserRead,
  Error,
  {
    userUpdateSettings: UserUpdateSettings
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { userUpdateSettings: UserUpdateSettings }) => {
      return api.users.updatePreferences({
        userUpdateSettings: variables.userUpdateSettings,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })

export const useListPersonalAccessTokens = () =>
  useQuery({
    queryKey: ['personalAccessTokens'],
    queryFn: () => api.personalAccessToken.list(),
    retry: defaultRetry,
  })

export const useCreatePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { comment: string }) => {
      return api.personalAccessToken.create({
        createPersonalAccessToken: {
          comment: variables.comment,
        },
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useDeletePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.personalAccessToken._delete({
        id: variables.id,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useMaintainerUpgrade = () =>
  useMutation({
    mutationFn: () => {
      return api.users.maintainerUpgrade()
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries()
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
    mutationFn: (userFreeSubscriptionCreate: UserFreeSubscriptionCreate) => {
      return api.users.createSubscription({ userFreeSubscriptionCreate })
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
