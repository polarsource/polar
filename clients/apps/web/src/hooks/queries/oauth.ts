import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOAuth2Clients = (
  options?: operations['oauth2:clients:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['oauth2Clients'],
    queryFn: async () =>
      unwrap(api.GET('/v1/oauth2/', { params: { query: options } })),
  })

export const useCreateOAuth2Client = () =>
  useMutation({
    mutationFn: (body: components['schemas']['OAuth2ClientConfiguration']) =>
      api.POST('/v1/oauth2/register', { body }),
    onSuccess(data, _variables, _context) {
      if (data.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useUpdateOAuth2Client = () =>
  useMutation({
    mutationFn: ({
      client_id,
      body,
    }: {
      client_id: string
      body: components['schemas']['OAuth2ClientConfigurationUpdate']
    }) =>
      api.PUT('/v1/oauth2/register/{client_id}', {
        params: { path: { client_id } },
        body,
      }),
    onSuccess(data, _variables, _context) {
      if (data.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useDeleteOAuthClient = () =>
  useMutation({
    mutationFn: (clientId: string) =>
      api.DELETE('/v1/oauth2/register/{client_id}', {
        params: { path: { client_id: clientId } },
      }),
    onSuccess(data, _variables, _context) {
      if (data.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })
