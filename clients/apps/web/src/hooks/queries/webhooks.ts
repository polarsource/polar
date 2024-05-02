import { api, queryClient } from '@/utils/api'
import {
  ListResourceWebhookDelivery,
  ListResourceWebhookEndpoint,
  ResponseError,
} from '@polar-sh/sdk'
import { UseQueryResult, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListWebhooksDeliveries = (variables: {
  webhookEndpointId: string
  limit: number
  page: number
}): UseQueryResult<ListResourceWebhookDelivery, ResponseError> =>
  useQuery({
    queryKey: ['webhookDeliveries', 'list', JSON.stringify(variables)],
    queryFn: () =>
      api.webhooks.listWebhookDeliveries({
        ...variables,
      }),
    retry: defaultRetry,
  })

export const useListWebhooksEndpoints = (variables: {
  organizationId: string
  limit: number
  page: number
}): UseQueryResult<ListResourceWebhookEndpoint, ResponseError> =>
  useQuery({
    queryKey: ['webhookEndpoints', 'list', JSON.stringify(variables)],
    queryFn: () =>
      api.webhooks.listWebhookEndpoints({
        ...variables,
      }),
    retry: defaultRetry,
  })

export const useRedeliverWebhookEvent = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.webhooks.redeliverWebhookEvent({
        id: variables.id,
      }),
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['webhookDeliveries', 'list'],
      })
    },
  })
