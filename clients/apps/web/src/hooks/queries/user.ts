import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePersonalAccessTokens = () =>
  useQuery({
    queryKey: ['personalAccessTokens'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/personal_access_tokens/', {
          params: { query: { limit: 100 } },
        }),
      ),
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
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['personalAccessTokens'] })
    },
  })

export const useCreateIdentityVerification = () =>
  useMutation({
    mutationFn: () => {
      return api.POST('/v1/users/me/identity-verification')
    },
  })

export const useUpdateUser = () =>
  useMutation({
    mutationFn: (body: schemas['UserUpdate']) => {
      return api.PATCH('/v1/users/me', { body })
    },
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['user'] })
    },
  })

export const useDeleteUser = () =>
  useMutation({
    mutationFn: () => {
      return api.DELETE('/v1/users/me')
    },
  })
