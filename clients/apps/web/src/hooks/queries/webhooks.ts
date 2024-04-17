import { api } from '@/utils/api'
import {
  ListResourceWebhookDelivery,
  ListResourceWebhookEndpoint,
  ResponseError,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchWebhooksDeliveries = (variables: {
  webhookEndpointId: string
  limit: number
  page: number
}): UseQueryResult<ListResourceWebhookDelivery, ResponseError> =>
  useQuery({
    queryKey: ['webhookDeliveries', 'search', JSON.stringify(variables)],
    queryFn: () =>
      api.webhooks.searchWebhookDeliveries({
        ...variables,
      }),
    retry: defaultRetry,
  })

export const useSearchWebhooksEndpoints = (variables: {
  organizationId: string
  limit: number
  page: number
}): UseQueryResult<ListResourceWebhookEndpoint, ResponseError> =>
  useQuery({
    queryKey: ['webhookEndpoints', 'search', JSON.stringify(variables)],
    queryFn: () =>
      api.webhooks.searchWebhookEndpoints({
        ...variables,
      }),
    retry: defaultRetry,
  })
