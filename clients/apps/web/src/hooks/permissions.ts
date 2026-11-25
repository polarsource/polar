import { useAuth } from '@/hooks/auth'
import { OrganizationPermission } from '@/hooks/queries/roles'

// Permissions are embedded on the user's organizations in the authenticated
// payload (`x-polar-user`), so the check is synchronous — no query, no loading
// state, and no flash before a definitive grant/denial.
export const useHasPermission = (
  organizationId: string | undefined,
  permission: OrganizationPermission,
): boolean => {
  const { userOrganizations } = useAuth()
  if (!organizationId) return false
  const organization = userOrganizations.find((o) => o.id === organizationId)
  return organization?.permissions.includes(permission) ?? false
}
