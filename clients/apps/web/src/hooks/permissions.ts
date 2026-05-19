import { useAuth } from '@/hooks/auth'
import {
  OrganizationPermission,
  useOrganizationRoles,
} from '@/hooks/queries/roles'
import { schemas } from '@polar-sh/client'

export const useOrganizationRole = (
  organizationId: string | undefined,
): schemas['OrganizationRole'] | null => {
  const { userOrganizations } = useAuth()
  if (!organizationId) return null
  const match = userOrganizations.find((o) => o.id === organizationId)
  return match?.role ?? null
}

// Returns `undefined` while the roles map is loading so callers can
// distinguish "still resolving" from a definitive grant/denial. Pages
// that switch to a restricted view should gate on `=== false`.
export const useHasPermission = (
  organizationId: string | undefined,
  permission: OrganizationPermission,
): boolean | undefined => {
  const role = useOrganizationRole(organizationId)
  const { data: roles, isLoading } = useOrganizationRoles(organizationId)

  if (!role) return false
  if (isLoading || !roles) return undefined
  const definition = roles.find((r) => r.id === role)
  return definition?.permissions.includes(permission) ?? false
}
