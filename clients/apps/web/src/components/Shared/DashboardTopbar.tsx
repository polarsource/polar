'use client'

import { useAuth, useCurrentOrgAndRepoFromURL } from '@/hooks'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { classNames } from 'polarkit/utils'
import { Suspense, useMemo } from 'react'
import {
  SubRoute,
  backerRoutes,
  maintainerRoutes,
} from '../Dashboard/navigation'
import Popover from '../Notifications/Popover'

export type LogoPosition = 'center' | 'left'

const SubNav = (props: { items: (SubRoute & { active: boolean })[] }) => {
  return (
    <div className="flex flex-row items-center gap-x-2 rounded-lg bg-gray-100 p-1 dark:border-gray-800 dark:bg-gray-800">
      {props.items.map((item) => {
        const className = classNames(
          item.active
            ? 'bg-white dark:bg-gray-900 shadow-md text-gray-950 dark:text-gray-300 font-medium'
            : 'text-gray-500 dark:gray-500 hover:text-gray-950 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          'dark-bg-900 flex flex-row rounded-md px-3 py-1 text-xs transition-colors',
        )

        return (
          <Link href={item.link} className={className}>
            {item.title}
          </Link>
        )
      })}
    </div>
  )
}

const DashboardTopbar = ({
  hideProfile,
  ...props
}: {
  useOrgFromURL: boolean
  hideProfile?: boolean
  isFixed?: boolean
}) => {
  const { org: currentOrgFromURL, isLoaded } = useCurrentOrgAndRepoFromURL()
  const { currentUser, hydrated } = useAuth()

  const useOrgFromURL = props.useOrgFromURL

  const currentOrg = useMemo(() => {
    return currentOrgFromURL && useOrgFromURL ? currentOrgFromURL : undefined
  }, [currentOrgFromURL, useOrgFromURL])

  const routes = currentOrg
    ? maintainerRoutes(currentOrg, isLoaded)
    : backerRoutes

  const pathname = usePathname()

  const [currentRoute] = routes.filter((route) =>
    pathname?.startsWith(route.link),
  )

  const className = classNames(
    props.isFixed !== false ? 'fixed z-20 left-0 top-0 right-0' : '',
    'flex h-20 w-full items-center justify-between space-x-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800',
  )

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      <div className={className}>
        <div className="relative flex w-full flex-row items-center justify-between px-4 sm:px-6 md:px-8">
          <div className="flex flex-row items-center gap-x-24">
            <h4 className="text-lg font-medium dark:text-gray-300">
              {currentRoute?.title}
            </h4>
            {currentRoute &&
              'subs' in currentRoute &&
              (currentRoute.subs?.length ?? 0) > 0 && (
                <SubNav
                  items={
                    currentRoute.subs?.map((sub) => ({
                      ...sub,
                      active: sub.link === pathname,
                    })) ?? []
                  }
                />
              )}
          </div>
          <div className="flex flex-row items-center gap-x-6">
            <Suspense>{currentUser && <Popover />}</Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
export default DashboardTopbar
