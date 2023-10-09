'use client'

import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoIcon } from 'polarkit/components/brand'
import { classNames } from 'polarkit/utils'
import { Suspense, useMemo } from 'react'
import { Route, backerRoutes, maintainerRoutes } from '../Dashboard/navigation'
import TopbarRight from './TopbarRight'

export type LogoPosition = 'center' | 'left'

const SubNav = (props: { items: (Route & { active: boolean })[] }) => {
  return (
    <div className="flex flex-row items-center gap-x-2 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800">
      {props.items.map((item) => {
        const className = classNames(
          item.active
            ? 'bg-white dark:bg-gray-900 shadow-lg text-gray-950 dark:text-gray-300 font-medium'
            : 'text-gray-500 dark:gray-500 hover:text-gray-950 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          'dark-bg-900 flex flex-row rounded-lg px-4 py-2 text-xs transition-colors',
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

const Topbar = ({
  hideProfile,
  ...props
}: {
  isFixed?: boolean
  customLogoTitle?: string
  hideProfile?: boolean
  logoPosition?: LogoPosition
  useOrgFromURL: boolean
}) => {
  const { org: currentOrgFromURL, isLoaded } = useCurrentOrgAndRepoFromURL()

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

  const logoPosition: LogoPosition = props?.logoPosition || 'left'

  const className = classNames(
    props.isFixed !== false ? 'fixed z-20 left-0 top-0 right-0' : '',
    'flex h-24 w-full items-center justify-between space-x-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800',
  )

  return (
    <>
      <div className={className}>
        <div className="flex w-full flex-row items-center justify-between px-4 sm:px-6 md:px-12">
          <div className="flex flex-row items-center gap-x-24">
            <h3 className="text-xl font-medium dark:text-gray-300">
              {currentRoute?.title}
            </h3>
            {currentRoute &&
              'subs' in currentRoute &&
              currentRoute.subs.length > 0 && (
                <SubNav
                  items={currentRoute.subs.map((sub) => ({
                    ...sub,
                    active: sub.link === pathname,
                  }))}
                />
              )}
          </div>
          <div>
            <Suspense>
              <TopbarRight useOrgFromURL={props.useOrgFromURL} />
            </Suspense>
          </div>
        </div>

        {logoPosition == 'center' && props.customLogoTitle && (
          <>
            <LogoIcon />
            <span className="font-display text-xl">
              {props.customLogoTitle}
            </span>
          </>
        )}
      </div>
    </>
  )
}
export default Topbar
