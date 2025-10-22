import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListWebhooksDeliveries = (variables: {
  webhookEndpointId: string
  limit: number
  page: number
  start_timestamp?: Date
  end_timestamp?: Date
}) =>
  useQuery({
    queryKey: ['webhookDeliveries', 'list', { ...variables }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/webhooks/deliveries', {
          params: {
            query: {
              endpoint_id: variables.webhookEndpointId,
              limit: variables.limit,
              page: variables.page,
              ...(variables.start_timestamp && {
                start_timestamp: variables.start_timestamp.toISOString(),
              }),
              ...(variables.end_timestamp && {
                end_timestamp: variables.end_timestamp.toISOString(),
              }),
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useListWebhooksEndpoints = (variables: {
  organizationId: string
  limit: number
  page: number
}) =>
  useQuery({
    queryKey: ['webhookEndpoints', 'list', { ...variables }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/webhooks/endpoints', {
          params: {
            query: {
              organization_id: variables.organizationId,
              limit: variables.limit,
              page: variables.page,
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useRedeliverWebhookEvent = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.POST('/v1/webhooks/events/{id}/redeliver', {
        params: {
          path: {
            id: variables.id,
          },
        },
      }),
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['webhookDeliveries', 'list'],
      })
    },
  })

export const useWebhookEndpoint = (id?: string) =>
  useQuery({
    queryKey: ['webhookEndpoint', 'id', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/webhooks/endpoints/{id}', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateWebhookEndpoint = () =>
  useMutation({
    mutationFn: (body: schemas['WebhookEndpointCreate']) =>
      api.POST('/v1/webhooks/endpoints', { body }),
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['webhookEndpoints', 'list'],
      })
    },
  })

export const useEditWebhookEndpoint = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['WebhookEndpointUpdate']
    }) =>
      api.PATCH('/v1/webhooks/endpoints/{id}', {
        params: {
          path: {
            id: variables.id,
          },
        },
        body: variables.body,
      }),
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoints', 'list'],
      })

      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoint', 'id', variables.id],
      })
    },
  })

export const useResetSecretWebhookEndpoint = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.PATCH('/v1/webhooks/endpoints/{id}/secret', {
        params: {
          path: {
            id: variables.id,
          },
        },
      }),
    onSuccess: (_result, _variables, _ctx) => {
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoints', 'list'],
      })

      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoint', 'id', _variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['webhookDeliveries', 'list'],
      })
    },
  })

export const useDeleteWebhookEndpoint = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.DELETE('/v1/webhooks/endpoints/{id}', {
        params: {
          path: {
            id: variables.id,
          },
        },
      }),
    onSuccess: (_result, _variables, _ctx) => {
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoints', 'list'],
      })

      queryClient.invalidateQueries({
        queryKey: ['webhookEndpoint', 'id', _variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['webhookDeliveries', 'list'],
      })
    },
  })
