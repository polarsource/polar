import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useAgentClaim = (linkToken: string) =>
  useQuery({
    queryKey: ['agentClaim', linkToken],
    queryFn: () =>
      unwrap(
        api.GET('/v1/agent/claim/{link_token}', {
          params: { path: { link_token: linkToken } },
        }),
      ),
    // Every error is final: unknown, used, expired, locked or for another account.
    retry: false,
  })

export const useConfirmAgentClaim = () =>
  useMutation({
    mutationFn: (body: schemas['AgentClaimConfirm']) =>
      api.POST('/v1/agent/claim', { body }),
  })
