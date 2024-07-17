'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { useMaintainerRoutes } from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const navs = useMaintainerRoutes(org ?? undefined)

  if (!org) {
    return <></>
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 py-3">
        {navs.map((n) => (
          <div key={n.link} className="flex flex-col gap-4">
            <Link
              className={twMerge(
                'flex items-center gap-x-3 rounded-lg border border-transparent px-4 transition-colors',
                n.isActive
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-700 hover:text-blue-500',
              )}
              href={n.link}
            >
              {'icon' in n && n.icon ? (
                <span
                  className={twMerge(
                    'flex h-8 w-8 flex-col items-center justify-center rounded-full bg-transparent text-[18px]',
                    n.isActive ? 'dark:text-blue-400' : 'bg-transparent',
                  )}
                >
                  {n.icon}
                </span>
              ) : undefined}
              <span className="text-sm font-medium">{n.title}</span>
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

export default MaintainerNavigation
