import {
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { dashboardRoutes } from './navigation'

const DashboardNavigation = () => {
  const path = usePathname()
  const { org } = useCurrentOrgAndRepoFromURL()
  const isOrgAdmin = useIsOrganizationAdmin(org)

  const personalOrg = usePersonalOrganization()
  const isPersonal = org?.id === personalOrg?.id

  // All routes and conditions
  const navs = org
    ? dashboardRoutes(org, isPersonal, isOrgAdmin)
    : dashboardRoutes(personalOrg, true, true)

  // Filter routes, set isActive, and if subs should be expanded
  const filteredNavs = navs
    .filter((n) => ('if' in n ? n.if : true))
    .map((n) => {
      const isActive = path && path.startsWith(n.link)
      return {
        ...n,
        isActive,
      }
    })

  return (
    <div className="flex flex-col gap-2">
      {filteredNavs.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <Link
            className={twMerge(
              'flex items-center gap-x-3 rounded-lg border border-transparent transition-colors',
              n.isActive
                ? 'text-blue-500 dark:text-blue-400'
                : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-700 hover:text-blue-500',
            )}
            href={n.link}
          >
            {'icon' in n && n.icon ? (
              <span
                className={twMerge(
                  'flex h-10 w-10 flex-col items-center justify-center rounded-full bg-transparent text-[18px]',
                  n.isActive
                    ? 'bg-blue-50 dark:bg-blue-950 dark:text-blue-400'
                    : 'bg-transparent',
                )}
              >
                {n.icon}
              </span>
            ) : undefined}
          </Link>
        </div>
      ))}
    </div>
  )
}

export default DashboardNavigation
