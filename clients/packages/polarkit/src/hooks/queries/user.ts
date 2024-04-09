import { UserRead, UserUpdateSettings } from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
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
