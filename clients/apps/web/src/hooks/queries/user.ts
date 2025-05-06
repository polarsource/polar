import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePersonalAccessTokens = () =>
  useQuery({
    queryKey: ['personalAccessTokens'],
    queryFn: () => unwrap(api.GET('/v1/personal_access_tokens/')),
    retry: defaultRetry,
  })

export const useDeletePersonalAccessToken = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.DELETE('/v1/personal_access_tokens/{id}', {
        params: {
          path: {
            id: variables.id,
          },
        },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useCreateIdentityVerification = () =>
  useMutation({
    mutationFn: () => {
      return api.POST('/v1/users/me/identity-verification')
    },
  })
