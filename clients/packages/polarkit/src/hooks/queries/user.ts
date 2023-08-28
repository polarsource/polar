import { useMutation, useQuery } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { UserUpdateSettings } from '../../api/client'
import { defaultRetry } from './retry'

export const useUser = () =>
  useQuery(['user'], () => api.users.getAuthenticated(), {
    retry: defaultRetry,
  })

export const useUserPreferencesMutation = () =>
  useMutation({
    mutationFn: (variables: { userUpdateSettings: UserUpdateSettings }) => {
      return api.users.updatePreferences({
        requestBody: variables.userUpdateSettings,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['user'])
    },
  })

export const useListPersonalAccessTokens = () =>
  useQuery(['personalAccessTokens'], () => api.personalAccessToken.list(), {
    retry: defaultRetry,
  })

export const useCreatePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { comment: string }) => {
      return api.personalAccessToken.create({
        requestBody: {
          comment: variables.comment,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['personalAccessTokens'])
    },
  })

export const useDeletePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.personalAccessToken.delete({
        id: variables.id,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['personalAccessTokens'])
    },
  })
