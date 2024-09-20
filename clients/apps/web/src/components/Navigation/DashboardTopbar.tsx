'use client'

import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { organizationPageLink } from '@/utils/nav'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { PropsWithChildren, useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { SubRouteWithActive } from '../Dashboard/navigation'
import TopbarRight from '../Layout/Public/TopbarRight'
import { useRoute } from './useRoute'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs className="md:-mx-4" value={current?.title}>
      <TabsList
        className="
          flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0"
      >
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link}>
              <TabsTrigger
                className="flex flex-row items-center gap-x-2 px-4"
                value={item.title}
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
  hideSubNav = false,
}: PropsWithChildren<{
  title?: string
  marginBottom?: boolean
  hideSubNav?: boolean
}>) => {
  const { currentUser } = useAuth()

  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const currentRoute = useRoute()

  const className = twMerge(
    'flex h-fit md:min-h-20 w-full items-center justify-between space-x-4 flex-col',
    marginBottom && 'mb-6',
  )

  return (
    <div className={className}>
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-x-4 gap-y-6 px-4 py-8 sm:px-6 md:gap-x-12 md:px-16 xl:gap-x-24">
        <div className="flex flex-row flex-wrap items-center justify-start">
          <h4 className="whitespace-nowrap text-2xl font-medium dark:text-white">
            {title ?? currentRoute?.title}
          </h4>
          <div className="flex w-full flex-1 flex-row items-center justify-end gap-x-6 md:justify-end">
            {children}
            {org.profile_settings?.enabled ? (
              <Link href={organizationPageLink(org)}>
                <Button>
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">
                      Storefront
                    </span>
                  </div>
                </Button>
              </Link>
            ) : null}
            <TopbarRight authenticatedUser={currentUser} />
          </div>
        </div>
        {currentRoute &&
        !hideSubNav &&
        'subs' in currentRoute &&
        (currentRoute.subs?.length ?? 0) > 0 ? (
          <div className="flex flex-row items-center gap-4 gap-y-24">
            <SubNav items={currentRoute.subs ?? []} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
export default DashboardTopbar
