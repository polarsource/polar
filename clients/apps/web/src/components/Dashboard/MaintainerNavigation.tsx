'use client'

import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { maintainerRoutes } from './navigation'

const MaintainerNavigation = () => {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  // All routes and conditions
  const navs = org ? maintainerRoutes(org) : []

  const pathname = usePathname()

  // Filter routes, set isActive, and if subs should be expanded
  const filteredNavs = navs
    .filter((n) => 'if' in n && n.if)
    .map((n) => {
      const isActive = pathname && pathname.startsWith(n.link)

      const subs =
        ('subs' in n &&
          n.subs?.map((s) => {
            return {
              ...s,
              isActive: pathname && pathname.startsWith(s.link),
            }
          })) ||
        []

      const anySubIsActive = subs.find((s) => s.isActive)

      return {
        ...n,
        isActive,
        expandSubs: isActive || anySubIsActive,
        subs,
      }
    })

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      {filteredNavs.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <Link
            className={twMerge(
              'flex items-center gap-x-4 rounded-xl border border-transparent px-5 py-3 transition-colors',
              n.isActive
                ? 'dark:bg-polar-800 dark:border-polar-700 bg-blue-50 text-blue-500 dark:text-blue-400'
                : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-900 hover:text-blue-700',
            )}
            href={n.link}
          >
            {'icon' in n && n.icon ? <span>{n.icon}</span> : undefined}
            <span className="text-sm font-medium">{n.title}</span>
            {'postIcon' in n && n.postIcon ? (
              <span>{n.postIcon}</span>
            ) : undefined}
          </Link>
        </div>
      ))}
    </div>
  )
}

export default MaintainerNavigation
