import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSlackIntegration = (
  { integrationId, benefitId }: { integrationId?: string; benefitId?: string },
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['slackIntegration', integrationId ?? null, benefitId ?? null],
    queryFn: async (): Promise<schemas['SlackIntegration'] | null> => {
      const response = await api.GET('/v1/integrations/slack/integration', {
        params: {
          query: integrationId
            ? { integration_id: integrationId }
            : { benefit_id: benefitId },
        },
      })
      if (response.response.status === 404) {
        return null
      }
      if (response.error) {
        throw response.error
      }
      return response.data ?? null
    },
    retry: defaultRetry,
    enabled: enabled && (!!integrationId || !!benefitId),
  })

export const useGenerateSlackManifest = () =>
  useMutation({
    mutationFn: (body: schemas['SlackIntegrationManifestRequest']) =>
      api.POST('/v1/integrations/slack/manifest', { body }),
  })

export const useSaveSlackCredentials = () =>
  useMutation({
    mutationFn: (body: schemas['SlackIntegrationCredentialsUpdate']) =>
      api.POST('/v1/integrations/slack/credentials', { body }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['slackIntegration'] })
    },
  })

export const useLinkSlackIntegration = () =>
  useMutation({
    mutationFn: (body: schemas['SlackIntegrationLink']) =>
      api.POST('/v1/integrations/slack/link', { body }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['slackIntegration'] })
    },
  })

export const usePreviewSlackChannelName = () =>
  useMutation({
    mutationFn: (body: schemas['ChannelNamePreviewRequest']) =>
      api.POST('/v1/benefits/slack/preview-channel-name', { body }),
  })

export const useSlackWorkspaceUsers = (
  integrationId?: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['slackWorkspaceUsers', integrationId],
    queryFn: async (): Promise<schemas['SlackWorkspaceUser'][]> => {
      const response = await api.GET('/v1/integrations/slack/users', {
        params: { query: { integration_id: integrationId ?? '' } },
      })
      if (response.error) {
        throw response.error
      }
      return response.data?.users ?? []
    },
    retry: defaultRetry,
    enabled: enabled && !!integrationId,
  })

export const useDeleteSlackIntegration = () =>
  useMutation({
    mutationFn: ({ integrationId }: { integrationId: string }) =>
      api.DELETE('/v1/integrations/slack/integration', {
        params: { query: { integration_id: integrationId } },
      }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['slackIntegration'] })
    },
  })
