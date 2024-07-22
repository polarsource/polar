import { api, queryClient } from '@/utils/api'
import { WebhookIntegration, WebhookIntegrationCreate } from '@polar-sh/sdk'
import { UseMutationResult, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchWebhookNotifications = (organizationId: string) =>
  useQuery({
    queryKey: ['webhookNotifications', organizationId],
    queryFn: () =>
      api.webhookNotifications.search({
        organizationId,
      }),
    retry: defaultRetry,
  })

export const useDeleteWebhookNotification: () => UseMutationResult<
  WebhookIntegration,
  Error,
  {
    id: string
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.webhookNotifications.delete({
        id: variables.id,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['webhookNotifications'] })
    },
  })

export const useCreateWebhookNotification: () => UseMutationResult<
  WebhookIntegration,
  Error,
  WebhookIntegrationCreate,
  unknown
> = () =>
  useMutation({
    mutationFn: (body: WebhookIntegrationCreate) => {
      return api.webhookNotifications.create({
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['webhookNotifications'] })
    },
  })
