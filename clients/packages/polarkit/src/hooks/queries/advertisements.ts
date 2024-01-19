import {
  AdvertisementCampaign,
  CreateAdvertisementCampaign,
  EditAdvertisementCampaign,
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
  benefit_id: string,
): UseQueryResult<ListResourceAdvertisementCampaign, Error> =>
  useQuery({
    queryKey: ['advertisements', 'campaigns', subscription_id, benefit_id],
    queryFn: () =>
      api.advertisements.searchCampaigns({
        subscriptionId: subscription_id,
        subscriptionBenefitId: benefit_id,
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

export const useEditAdvertisementCampaigns: () => UseMutationResult<
  AdvertisementCampaign,
  Error,
  {
    id: string
    editAdvertisementCampaign: EditAdvertisementCampaign
  },
  unknown
> = () =>
  useMutation({
    mutationFn: ({
      id,
      editAdvertisementCampaign,
    }: {
      id: string
      editAdvertisementCampaign: EditAdvertisementCampaign
    }) => {
      return api.advertisements.editCampaign({
        id,
        editAdvertisementCampaign,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['advertisements', 'campaigns', result.subscription_id],
      })
    },
  })

export const useDeleteAdvertisementCampaigns: () => UseMutationResult<
  AdvertisementCampaign,
  Error,
  {
    id: string
  },
  unknown
> = () =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.advertisements.deleteCampaign({
        id,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['advertisements', 'campaigns', result.subscription_id],
      })
    },
  })
