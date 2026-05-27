import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSlackIntegration = (
  benefitId?: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['slackIntegration', benefitId],
    queryFn: async (): Promise<schemas['SlackIntegration'] | null> => {
      const response = await api.GET('/v1/integrations/slack/integration', {
        params: {
          query: {
            benefit_id: benefitId ?? '',
          },
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
    enabled: enabled && !!benefitId,
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
    onSuccess: (result, variables) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['slackIntegration', variables.benefit_id],
      })
    },
  })

export const usePreviewSlackChannelName = () =>
  useMutation({
    mutationFn: (body: schemas['ChannelNamePreviewRequest']) =>
      api.POST('/v1/benefits/slack/preview-channel-name', { body }),
  })

export const useSlackWorkspaceUsers = (
  benefitId?: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['slackWorkspaceUsers', benefitId],
    queryFn: async (): Promise<schemas['SlackWorkspaceUser'][]> => {
      const response = await api.GET('/v1/integrations/slack/users', {
        params: { query: { benefit_id: benefitId ?? '' } },
      })
      if (response.error) {
        throw response.error
      }
      return response.data?.users ?? []
    },
    retry: defaultRetry,
    enabled: enabled && !!benefitId,
  })

export const useDeleteSlackIntegration = () =>
  useMutation({
    mutationFn: ({ benefitId }: { benefitId: string }) =>
      api.DELETE('/v1/integrations/slack/integration', {
        params: { query: { benefit_id: benefitId } },
      }),
    onSuccess: (result, variables) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['slackIntegration', variables.benefitId],
      })
    },
  })
