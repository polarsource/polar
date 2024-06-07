import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { useDashboardRoutes } from './navigation'

const DashboardNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const adminOrgs = orgContext?.adminOrganizations ?? []
  const personalOrg = orgContext?.personalOrganization
  const isOrgAdmin = adminOrgs.some((o) => org && o.id === org.id)
  const isPersonal = Boolean(org && personalOrg && org.id === personalOrg.id)
  const navs = useDashboardRoutes(org, isPersonal, isOrgAdmin ?? false)

  if (!org || navs.length === 0) {
    return <></>
  }

  return (
    <>
      <div className="flex w-full flex-row items-center gap-x-2 px-7 pt-2">
        <div className="dark:text-polar-400 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gray-500">
          Account
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        {navs.map((n) => (
          <div key={n.link} className="flex flex-col gap-4">
            <Link
              className={twMerge(
                'flex items-center justify-between gap-x-3 rounded-lg border border-transparent px-4 transition-colors',
                n.isActive
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-700 hover:text-blue-500',
              )}
              href={n.link}
            >
              <span className="flex flex-row items-center gap-x-3">
                {'icon' in n && n.icon ? (
                  <span
                    className={twMerge(
                      'flex h-8 w-8 flex-col items-center justify-center rounded-full bg-transparent text-[18px]',
                      n.isActive
                        ? 'bg-blue-50 dark:bg-blue-950 dark:text-blue-400'
                        : 'bg-transparent',
                    )}
                  >
                    {n.icon}
                  </span>
                ) : undefined}
                <span className="text-sm font-medium">{n.title}</span>
              </span>
              {'postIcon' in n && n.postIcon ? (
                <span>{n.postIcon}</span>
              ) : undefined}
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}

export default DashboardNavigation
