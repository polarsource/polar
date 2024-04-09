import { queryClient } from '@/utils/api'

export const onOrganizationUpdated = async () => {
  // TODO: we could do these more selectively
  await queryClient.invalidateQueries({ queryKey: ['organization'] })
  await queryClient.invalidateQueries({ queryKey: ['user', 'organizations'] })
}
