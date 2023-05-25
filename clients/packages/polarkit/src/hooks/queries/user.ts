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
