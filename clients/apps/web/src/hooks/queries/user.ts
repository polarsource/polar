import { api, queryClient } from '@/utils/api'
import { PersonalAccessTokenCreate } from '@polar-sh/sdk'
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
