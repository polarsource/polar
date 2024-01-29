'use client'

import {
  useAuth,
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Route,
  SubRoute,
  dashboardRoutes,
  maintainerRoutes,
} from '../Dashboard/navigation'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: {
  items: (SubRoute & { active: boolean })[]
}) => {
  const current = props.items.find((i) => i.active)

  return (
    <Tabs defaultValue={current?.title}>
      <TabsList className="dark:border-polar-700 flex-row dark:border">
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
  title,
  hideProfile,
  ...props
}: PropsWithChildren<{
  title?: string
  useOrgFromURL: boolean
  hideProfile?: boolean
  isFixed?: boolean
}>) => {
  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()

  const { hydrated } = useAuth()
  const isOrgAdmin = useIsOrganizationAdmin(currentOrgFromURL)
  const isPersonal = currentOrgFromURL?.name === personalOrg?.name

  const pathname = usePathname()

  const getRoutes = (
    pathname: string | null,
    currentOrg?: Organization,
  ): Route[] => {
    return [
      ...(currentOrg ? maintainerRoutes(currentOrg) : []),
      ...dashboardRoutes(
        currentOrg,
        currentOrg ? isPersonal : true,
        isOrgAdmin,
      ),
    ]
  }

  const routes = getRoutes(pathname, currentOrgFromURL)

  const [currentRoute] = routes.filter(
    (route) => pathname?.startsWith(route.link),
  )

  const className = twMerge(
    props.isFixed !== false ? 'md:fixed z-20 left-0 top-0 right-0' : '',
    'flex h-fit md:h-20 w-full items-center justify-between space-x-4 bg-white dark:bg-polar-900 border-b border-gray-100 dark:border-polar-800',
  )

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      <div className={className}>
        <div className="relative flex w-full max-w-screen-xl flex-col justify-between gap-y-4 px-4 py-4 sm:px-6 md:mx-auto md:flex-row md:items-center md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-24">
            <h4 className="dark:text-polar-100 text-lg font-medium">
              {title ?? currentRoute?.title}
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
          {children && (
            <div className="flex flex-row items-center gap-x-6">{children}</div>
          )}
        </div>
      </div>
    </>
  )
}
export default DashboardTopbar
