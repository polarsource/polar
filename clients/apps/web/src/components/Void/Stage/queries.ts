import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activeDeploy,
  useVoidDeploys,
  voidKeys,
  voidRequest,
  VoidRequestError,
  type VoidDeploy,
} from '../api'
import type { Configuration } from './diff'

export interface Stage {
  revision: number
  configuration: Configuration
}

export const stageKey = (organizationId: string) => [
  'void_stage',
  organizationId,
]

export const useSaveStage = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      expected_revision: number | null
      configuration: Configuration
    }) => voidRequest<Stage>(organizationId, '/stage', { method: 'PUT', body }),
    onSuccess: (stage) =>
      queryClient.setQueryData(stageKey(organizationId), stage),
    onError: (error) => {
      if (error instanceof VoidRequestError && error.status === 409)
        return queryClient.invalidateQueries({
          queryKey: stageKey(organizationId),
        })
    },
  })
}

export const useStage = (organizationId: string) => {
  const queryClient = useQueryClient()
  const stage = useQuery({
    queryKey: stageKey(organizationId),
    queryFn: async () => {
      try {
        return await voidRequest<Stage>(organizationId, '/stage')
      } catch (error) {
        if (error instanceof VoidRequestError && error.status === 404)
          return null
        throw error
      }
    },
    retry: false,
  })
  const deploys = useVoidDeploys(organizationId)
  const applied = activeDeploy(deploys.data ?? [])
  const configuration = useQuery({
    queryKey: voidKeys.deployConfiguration(organizationId, applied?.id ?? ''),
    queryFn: () =>
      voidRequest<Configuration>(
        organizationId,
        `/deploys/${applied!.id}/configuration`,
      ),
    enabled: !!applied?.id && applied.has_configuration,
    retry: false,
  })
  const refresh = () => Promise.all([stage.refetch(), deploys.refetch()])
  const deploy = useMutation({
    mutationFn: ({
      revision,
      activate,
    }: {
      revision: number
      activate: boolean
    }) =>
      voidRequest<VoidDeploy>(organizationId, '/stage/deploy', {
        method: 'POST',
        body: { expected_revision: revision, activate },
      }),
    onSuccess: (_, { revision }) => {
      queryClient.setQueryData<Stage | null>(
        stageKey(organizationId),
        (current) => (current?.revision === revision ? null : current),
      )
      return queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          typeof queryKey[0] === 'string' &&
          queryKey[0].startsWith('void_') &&
          queryKey[1] === organizationId,
      })
    },
  })
  return { stage, deploys, applied, configuration, deploy, refresh }
}
