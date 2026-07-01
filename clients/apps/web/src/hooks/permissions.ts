import { useAuth } from '@/hooks/auth'
import { OrganizationPermission } from '@/hooks/queries/roles'

// The full permission set, granted to the `owner` role. Used as an optimistic
// value when a freshly-created organization is added to the auth context before
// the next `/users/me` refetch returns the authoritative permissions.
export const OWNER_PERMISSIONS: OrganizationPermission[] = [
  'organization:manage',
  'members:read',
  'members:manage',
  'products:read',
  'products:manage',
  'custom_fields:read',
  'custom_fields:manage',
  'customers:read',
  'customers:manage',
  'sales:read',
  'sales:manage',
  'analytics:read',
  'analytics:manage',
  'events:ingest',
  'finance:read',
  'finance:manage',
]

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
