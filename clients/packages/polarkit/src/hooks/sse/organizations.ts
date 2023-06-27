import { queryClient } from '../../..'

export const onOrganizationUpdated = async (params: {
  organization_id: string
}) => {
  // TODO: we could do these more selectively
  await queryClient.invalidateQueries(['organization'])
  await queryClient.invalidateQueries(['user', 'organizations'])
}
