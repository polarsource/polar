import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListLLMProviderConfigs = (variables: {
  organizationId: string
  limit: number
  page: number
}) =>
  useQuery({
    queryKey: ['llmProviderConfigs', 'list', { ...variables }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/llm-provider-configs/', {
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

export const useCreateLLMProviderConfig = () =>
  useMutation({
    mutationFn: (body: schemas['LLMProviderConfigCreate']) =>
      api.POST('/v1/llm-provider-configs/', { body }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['llmProviderConfigs', 'list'],
      })
    },
  })

export const useUpdateLLMProviderConfig = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['LLMProviderConfigUpdate']
    }) =>
      api.PATCH('/v1/llm-provider-configs/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['llmProviderConfigs', 'list'],
      })
    },
  })

export const useDeleteLLMProviderConfig = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.DELETE('/v1/llm-provider-configs/{id}', {
        params: { path: { id: variables.id } },
      }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['llmProviderConfigs', 'list'],
      })
    },
  })
