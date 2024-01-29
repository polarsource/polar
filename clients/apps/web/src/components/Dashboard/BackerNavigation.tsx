import {
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { backerRoutes, dashboardRoutes } from './navigation'

const BackerNavigation = () => {
  const path = usePathname()
  const { org } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()
  const isOrgAdmin = useIsOrganizationAdmin(org)
  const isPersonal = org?.id === personalOrg?.id

  // All routes and conditions
  const navs = org
    ? [
        ...backerRoutes(org, personalOrg?.id === org.id),
        ...dashboardRoutes(org, isPersonal, isOrgAdmin),
      ]
    : [
        ...backerRoutes(personalOrg, true),
        ...dashboardRoutes(personalOrg, true, true),
      ]

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
    <div className="flex flex-row items-center">
      {filteredNavs.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <Link
            className={twMerge(
              'flex items-center gap-x-2 rounded-full border border-transparent px-4 py-1.5 transition-colors',
              n.isActive
                ? 'bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-300'
                : 'dark:text-polar-500 dark:hover:text-polar-300 text-gray-500 hover:text-blue-500',
            )}
            href={n.link}
          >
            {'title' in n && n.title ? (
              <span className={twMerge('text-sm')}>{n.title}</span>
            ) : undefined}
          </Link>
        </div>
      ))}
    </div>
  )
}

export default BackerNavigation
