'use client'

import {
  useAuth,
  useCurrentOrgAndRepoFromURL,
  useCurrentTeamFromURL,
} from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Route,
  SubRoute,
  backerRoutes,
  dashboardRoutes,
  maintainerRoutes,
} from '../Dashboard/navigation'

export type LogoPosition = 'center' | 'left'

const SubNav = (props: { items: (SubRoute & { active: boolean })[] }) => {
  const current = props.items.find((i) => i.active)

  return (
    <Tabs defaultValue={current?.title}>
      <TabsList className="dark:border-polar-700 dark:border">
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link}>
              <TabsTrigger
                className="items-baseline"
                value={item.title}
                size="small"
              >
                {item.icon && <div className="text-[17px]">{item.icon}</div>}
                <div>{item.title}</div>
              </TabsTrigger>
            </Link>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

const DashboardTopbar = ({
  children,
  hideProfile,
  ...props
}: PropsWithChildren<{
  useOrgFromURL: boolean
  hideProfile?: boolean
  isFixed?: boolean
}>) => {
  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const { org: currentTeamFromURL } = useCurrentTeamFromURL()

  const { hydrated } = useAuth()

  const useOrgFromURL = props.useOrgFromURL

  const currentOrg = useMemo(() => {
    if (!useOrgFromURL) {
      return undefined
    }

    if (currentTeamFromURL) {
      return currentTeamFromURL
    }

    if (currentOrgFromURL) {
      return currentOrgFromURL
    }

    return undefined
  }, [currentOrgFromURL, useOrgFromURL, currentTeamFromURL])

  const pathname = usePathname()

  const getRoutes = (
    pathname: string | null,
    currentOrg?: Organization,
  ): Route[] => {
    if (pathname && pathname.startsWith('/maintainer/') && currentOrg) {
      return [...maintainerRoutes(currentOrg), ...dashboardRoutes(currentOrg)]
    }

    if (pathname && pathname.startsWith('/team/') && currentOrg) {
      return [...maintainerRoutes(currentOrg), ...dashboardRoutes(currentOrg)]
    }

    return [...backerRoutes, ...dashboardRoutes(currentOrgFromURL)]
  }

  const routes = getRoutes(pathname, currentOrg)

  const [currentRoute] = routes.filter((route) =>
    pathname?.startsWith(route.link),
  )

  const className = twMerge(
    props.isFixed !== false ? 'fixed z-20 left-0 top-0 right-0' : '',
    'flex h-20 w-full items-center justify-between space-x-4 bg-white dark:bg-polar-900 border-b border-gray-100 dark:border-polar-800',
  )

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      <div className={className}>
        <div className="relative mx-auto flex w-full max-w-screen-xl flex-row items-center justify-between px-4 sm:px-6 md:px-8">
          <div className="flex flex-row items-center gap-x-24">
            <h4 className="dark:text-polar-100 text-lg font-medium">
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
          <div className="flex flex-row items-center gap-x-6">{children}</div>
        </div>
      </div>
    </>
  )
}
export default DashboardTopbar
