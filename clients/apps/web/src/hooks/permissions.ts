import { useAuth } from '@/hooks/auth'
import { OrganizationPermission } from '@/hooks/queries/roles'

export const useOrganizationPermissions = (
  organizationId: string | undefined,
): readonly OrganizationPermission[] => {
  const { userOrganizations } = useAuth()
  if (!organizationId) return []
  return (
    userOrganizations.find((organization) => organization.id === organizationId)
      ?.permissions ?? []
  )
}

export const useHasPermission = (
  organizationId: string | undefined,
  permission: OrganizationPermission,
): boolean => {
  const permissions = useOrganizationPermissions(organizationId)
  return permissions.includes(permission)
}
