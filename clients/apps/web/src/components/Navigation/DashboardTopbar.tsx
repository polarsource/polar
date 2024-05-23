'use client'

import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { organizationPageLink } from '@/utils/nav'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { PropsWithChildren, useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  SubRouteWithActive,
  useDashboardRoutes,
  useMaintainerRoutes,
} from '../Dashboard/navigation'
import TopbarRight from '../Layout/Public/TopbarRight'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs value={current?.title}>
      <TabsList
        className="
          flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0"
      >
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link}>
              <TabsTrigger
                className="flex flex-row items-center gap-x-2"
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
  marginBottom = true,
}: PropsWithChildren<{
  title?: string
  useOrgFromURL: boolean
  marginBottom?: boolean
}>) => {
  const { currentUser } = useAuth()

  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const personalOrg = orgContext?.personalOrganization
  const adminOrgs = orgContext?.adminOrganizations ?? []
  const isOrgAdmin = adminOrgs.some((o) => org && o.id === org.id)
  const isPersonal = Boolean(org && personalOrg && org.id === personalOrg.id)

  const maintainerRoutes = useMaintainerRoutes(org, true)
  const dashboardRoutes = useDashboardRoutes(
    org,
    org ? isPersonal : true,
    isOrgAdmin ?? false,
  )

  const routes = [...maintainerRoutes, ...dashboardRoutes]
  const currentRoute = routes.find((r) => r.isActive)

  const className = twMerge(
    'flex h-fit md:min-h-20 w-full items-center justify-between space-x-4',
    marginBottom && 'mb-6',
  )

  return (
    <>
      <div className={className}>
        <div className="mx-auto flex w-full max-w-screen-xl flex-row flex-wrap items-center justify-start gap-x-4 gap-y-2 px-4 py-8 sm:px-6 md:gap-x-12 md:px-8 xl:gap-x-24">
          <h4 className="dark:text-polar-100 whitespace-nowrap text-xl font-medium">
            {title ?? currentRoute?.title}
          </h4>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-y-24">
            {currentRoute &&
            'subs' in currentRoute &&
            (currentRoute.subs?.length ?? 0) > 0 ? (
              <SubNav items={currentRoute.subs ?? []} />
            ) : null}
          </div>
          <div className="flex w-full flex-1 flex-row items-center justify-end gap-x-6 md:justify-end">
            {children}
            {org ? (
              <Link href={organizationPageLink(org)}>
                <Button>
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">
                      Public Page
                    </span>
                  </div>
                </Button>
              </Link>
            ) : null}
            <TopbarRight authenticatedUser={currentUser} />
          </div>
        </div>
      </div>
    </>
  )
}
export default DashboardTopbar
