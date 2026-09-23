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
    mutationFn: (revision: number) =>
      voidRequest<VoidDeploy>(organizationId, '/stage/deploy', {
        method: 'POST',
        body: { expected_revision: revision },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: voidKeys.deploys(organizationId),
      }),
  })
  return { stage, deploys, applied, configuration, deploy, refresh }
}
