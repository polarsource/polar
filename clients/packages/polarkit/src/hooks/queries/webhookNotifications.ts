import {
  ListResourceWebhookIntegration,
  Platforms,
  ResponseError,
  WebhookIntegration,
  WebhookIntegrationCreate,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useSearchWebhookNotifications: (
  platform: Platforms,
  organizationName: string,
) => UseQueryResult<ListResourceWebhookIntegration, ResponseError> = (
  platform: Platforms,
  organizationName: string,
) =>
  useQuery({
    queryKey: ['webhookNotifications', organizationName],
    queryFn: () =>
      api.webhookNotifications.search({
        platform: platform,
        organizationName: organizationName,
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
      return api.webhookNotifications._delete({
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
    mutationFn: (variables: WebhookIntegrationCreate) => {
      return api.webhookNotifications.create({
        webhookIntegrationCreate: variables,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['webhookNotifications'] })
    },
  })
