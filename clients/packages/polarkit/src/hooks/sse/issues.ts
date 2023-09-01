import { queryClient } from '../../api'

export const onIssueUpdated = async (params: {
  organization_id: string
  organization_name: string
  repository_id: string
  repository_name: string
}) => {
  const cacheKey = [
    'issues',
    'repo',
    params.organization_name,
    params.repository_name,
  ]
  await queryClient.invalidateQueries({ queryKey: cacheKey })
}
