import AccessRestricted from '@/components/Finance/AccessRestricted'
import { getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'

// Server component: gates a route segment on an organization permission.
// Permissions are read from the authenticated payload (`x-polar-user`), so the
// check runs during SSR with no fetch and no client-side loading flash.
export default async function OrganizationPermissionGuard({
  organizationSlug,
  permission,
  message,
  children,
}: {
  organizationSlug: string
  permission: schemas['OrganizationPermission']
  message: string
  children: React.ReactNode
}) {
  const userOrganizations = await getUserOrganizations()
  const organization = userOrganizations.find(
    (o) => o.slug === organizationSlug,
  )

  if (!organization?.permissions.includes(permission)) {
    return <AccessRestricted message={message} />
  }

  return <>{children}</>
}
