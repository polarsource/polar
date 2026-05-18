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

// Returns false while roles map is loading; callers can use this to disable
// controls during fetch.
export const useHasPermission = (
  organizationId: string | undefined,
  permission: OrganizationPermission,
): boolean => {
  const role = useOrganizationRole(organizationId)
  const { data: roles } = useOrganizationRoles(organizationId)

  if (!role || !roles) return false
  const definition = roles.find((r) => r.id === role)
  return definition?.permissions.includes(permission) ?? false
}
