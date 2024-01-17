import {
  AdvertisementCampaign,
  CreateAdvertisementCampaign,
  ListResourceAdvertisementCampaign,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'

import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useAdvertisementCampaigns = (
  subscription_id: string,
): UseQueryResult<ListResourceAdvertisementCampaign, Error> =>
  useQuery({
    queryKey: ['advertisements', 'campaigns', subscription_id],
    queryFn: () =>
      api.advertisements.searchCampaigns({
        subscriptionId: subscription_id,
      }),
    retry: defaultRetry,
  })

export const useCreateAdvertisementCampaigns: () => UseMutationResult<
  AdvertisementCampaign,
  Error,
  {
    createAdvertisementCampaign: CreateAdvertisementCampaign
  },
  unknown
> = () =>
  useMutation({
    mutationFn: ({
      createAdvertisementCampaign,
    }: {
      createAdvertisementCampaign: CreateAdvertisementCampaign
    }) => {
      return api.advertisements.createCampaign({
        createAdvertisementCampaign,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['advertisements', 'campaigns', result.subscription_id],
      })
    },
  })
