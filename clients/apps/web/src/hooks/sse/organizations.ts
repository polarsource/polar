import { getQueryClient } from '@/utils/api/query'

// oxlint-disable-next-line typescript/no-unused-vars
export const onOrganizationUpdated = async (_payload: unknown) => {
  // TODO: we could do these more selectively
  const queryClient = getQueryClient()
  await queryClient.invalidateQueries({ queryKey: ['organization'] })
  await queryClient.invalidateQueries({ queryKey: ['user', 'organizations'] })
}
