import { api, queryClient } from '@/utils/api'
import {
  OAuth2Client,
  OAuth2ClientConfiguration,
  Oauth2ApiListOauth2ClientsRequest,
  Oauth2ApiOauth2ConfigurePutRequest,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOAuth2Clients = (options?: Oauth2ApiListOauth2ClientsRequest) =>
  useQuery({
    queryKey: ['oauth2Clients'],
    queryFn: async () => api.oauth2.listOauth2Clients(options),
  })

export const useCreateOAuth2Client = () =>
  useMutation({
    mutationFn: (config: OAuth2ClientConfiguration) =>
      api.oauth2.oauth2Register({
        oAuth2ClientConfiguration: config,
      }) as Promise<OAuth2Client>,
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })

export const useEditOAuth2Client = () =>
  useMutation({
    mutationFn: (options: Oauth2ApiOauth2ConfigurePutRequest) =>
      api.oauth2.oauth2ConfigurePut(options),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })
