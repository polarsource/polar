import { api, queryClient } from '@/utils/api'
import {
  OAuth2Client,
  OAuth2ClientConfiguration,
  Oauth2ClientsApiListRequest,
  Oauth2ClientsApiUpdateClientRequest,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOAuth2Clients = (options?: Oauth2ClientsApiListRequest) =>
  useQuery({
    queryKey: ['oauth2Clients'],
    queryFn: async () => api.oauth2Clients.list(options),
  })

export const useCreateOAuth2Client = () =>
  useMutation({
    mutationFn: (body: OAuth2ClientConfiguration) =>
      api.oauth2Clients.createClient({
        body,
      }) as Promise<OAuth2Client>,
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useUpdateOAuth2Client = () =>
  useMutation({
    mutationFn: (options: Oauth2ClientsApiUpdateClientRequest) =>
      api.oauth2Clients.updateClient(options),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useDeleteOAuthClient = () =>
  useMutation({
    mutationFn: (clientId: string) =>
      api.oauth2Clients.deleteClient({ clientId }),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })
