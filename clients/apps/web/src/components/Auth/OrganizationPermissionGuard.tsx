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
  standalone = false,
}: {
  organizationSlug: string
  permission: schemas['OrganizationPermission']
  message?: string
  children: React.ReactNode
  standalone?: boolean
}) {
  const userOrganizations = await getUserOrganizations()
  const organization = userOrganizations.find(
    (o) => o.slug === organizationSlug,
  )

  if (!organization?.permissions.includes(permission)) {
    if (standalone) {
      return (
        <div className="flex h-full w-full">
          <div className="dark:bg-polar-900 dark:border-polar-800 relative flex min-w-0 flex-2 flex-col items-center rounded-2xl border-gray-200 bg-white px-4 md:overflow-y-auto md:border md:px-8 md:shadow-xs">
            <div className="h-full w-full max-w-(--breakpoint-xl) p-8">
              <AccessRestricted message={message} />
            </div>
          </div>
        </div>
      )
    }

    return <AccessRestricted message={message} />
  }

  return children
}
