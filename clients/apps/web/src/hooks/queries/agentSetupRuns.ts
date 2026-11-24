import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'

const agentSetupRunKey = (organizationId: string) => [
  'agentSetupRun',
  organizationId,
]

export const useAgentSetupRun = (
  organizationId: string,
  refetchInterval?: number,
) =>
  useQuery({
    queryKey: agentSetupRunKey(organizationId),
    queryFn: async () => {
      const { data, response } = await api.GET(
        '/v1/agent-setup-runs/organization/{id}',
        { params: { path: { id: organizationId } } },
      )
      if (response.status === 404) {
        return null
      }
      if (!data) {
        throw new Error('Could not load the setup run')
      }
      return data
    },
    refetchInterval,
  })

export const useCreateAgentSetupRun = (organizationId: string) =>
  useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/agent-setup-runs/organization/{id}', {
          params: { path: { id: organizationId } },
        }),
      ),
    onSuccess: () =>
      getQueryClient().invalidateQueries({
        queryKey: agentSetupRunKey(organizationId),
      }),
  })

export const useApproveAgentSetupDrafts = (organizationId: string) =>
  useMutation({
    mutationFn: (drafts: schemas['AgentSetupDrafts']) =>
      unwrap(
        api.POST('/v1/agent-setup-runs/organization/{id}/approve', {
          params: { path: { id: organizationId } },
          body: drafts,
        }),
      ),
    onSuccess: () =>
      getQueryClient().invalidateQueries({
        queryKey: agentSetupRunKey(organizationId),
      }),
  })
