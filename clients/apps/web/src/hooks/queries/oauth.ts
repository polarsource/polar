import { api, queryClient } from '@/utils/api'
import {
  OAuth2Client,
  OAuth2ClientConfiguration,
  Oauth2ApiListClientsRequest,
  Oauth2ApiUpdateClientRequest,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOAuth2Clients = (options?: Oauth2ApiListClientsRequest) =>
  useQuery({
    queryKey: ['oauth2Clients'],
    queryFn: async () => api.oauth2.listClients(options),
  })

export const useCreateOAuth2Client = () =>
  useMutation({
    mutationFn: (body: OAuth2ClientConfiguration) =>
      api.oauth2.createClient({
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
    mutationFn: (options: Oauth2ApiUpdateClientRequest) =>
      api.oauth2.updateClient(options),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useDeleteOAuthClient = () =>
  useMutation({
    mutationFn: (clientId: string) => api.oauth2.deleteClient({ clientId }),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })
