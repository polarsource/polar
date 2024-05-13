import { api, queryClient } from '@/utils/api'
import { OAuth2ClientConfiguration } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useOAuth2Clients = () =>
  useQuery({
    queryKey: ['oauth2Clients'],
    queryFn: async () => ({
      items: [],
    }),
  })

export const useCreateOAuth2Client = () =>
  useMutation({
    mutationFn: (config: OAuth2ClientConfiguration) =>
      api.oauth2.oauth2Register({
        oAuth2ClientConfiguration: config,
      }),
    onSuccess(_data, _variables, _context) {
      queryClient.invalidateQueries({
        queryKey: ['oauth2Clients'],
      })
    },
  })
