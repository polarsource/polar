import { getQueryClient } from '@/utils/api/query'

export const onOrganizationUpdated = async () => {
  // TODO: we could do these more selectively
  const queryClient = getQueryClient()
  await queryClient.invalidateQueries({ queryKey: ['organization'] })
  await queryClient.invalidateQueries({ queryKey: ['user', 'organizations'] })
}
