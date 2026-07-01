import AccessRestricted from '@/components/Finance/AccessRestricted'
import { getUserOrganizations } from '@/utils/user'
import { schemas } from '@polar-sh/client'

// Server component: gates a route segment on an organization permission.
// Permissions are read from the authenticated payload (`x-polar-user`), so the
// check runs during SSR with no fetch and no client-side loading flash.
const DEFAULT_MESSAGE =
  "You don't have permission to view this page. Ask an organization admin if you need access."

export default async function OrganizationPermissionGuard({
  organizationSlug,
  permission,
  message = DEFAULT_MESSAGE,
  children,
}: {
  organizationSlug: string
  permission: schemas['OrganizationPermission']
  message?: string
  children: React.ReactNode
}) {
  const userOrganizations = await getUserOrganizations()
  const organization = userOrganizations.find(
    (o) => o.slug === organizationSlug,
  )

  if (!organization?.permissions.includes(permission)) {
    return <AccessRestricted message={message} />
  }

  return children
}
