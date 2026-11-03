import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useAgentClaimPreview = (linkToken: string, enabled: boolean) =>
  useQuery({
    queryKey: ['agentClaimPreview', linkToken],
    queryFn: () =>
      unwrap(
        api.GET('/v1/agent/claim/{link_token}/preview', {
          params: { path: { link_token: linkToken } },
        }),
      ),
    enabled,
    retry: false,
  })

export const useAgentClaim = (linkToken: string, enabled: boolean) =>
  useQuery({
    queryKey: ['agentClaim', linkToken],
    queryFn: () =>
      unwrap(
        api.GET('/v1/agent/claim/{link_token}', {
          params: { path: { link_token: linkToken } },
        }),
      ),
    enabled,
    // Every error is final: unknown, used, expired or for another account.
    retry: false,
  })

export const useConfirmAgentClaim = () =>
  useMutation({
    mutationFn: (body: schemas['AgentClaimConfirm']) =>
      api.POST('/v1/agent/claim', { body }),
  })
