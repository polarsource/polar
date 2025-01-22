'use client'

import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { organizationPageLink } from '@/utils/nav'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import React, { useContext } from 'react'
import { SubRouteWithActive } from '../Dashboard/navigation'
import TopbarRight from '../Layout/Public/TopbarRight'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs className="md:-mx-4" value={current?.title}>
      <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
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

const DashboardTopbar = ({ breadcrumb }: { breadcrumb?: React.ReactNode }) => {
  const { currentUser } = useAuth()

  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  return (
    <div className="hidden w-full flex-col md:flex">
      <div className="flex w-full flex-row items-center justify-between gap-x-8">
        <div className="hidden w-full flex-grow flex-row items-center gap-x-8 md:flex">
          {breadcrumb}
        </div>
        <div className="flex flex-row items-center gap-x-6">
          {org.profile_settings?.enabled ? (
            <Link href={organizationPageLink(org)}>
              <Button>
                <div className="flex flex-row items-center gap-x-2">
                  <span className="whitespace-nowrap text-xs">Storefront</span>
                </div>
              </Button>
            </Link>
          ) : null}
          <TopbarRight authenticatedUser={currentUser} />
        </div>
      </div>
    </div>
  )
}
export default DashboardTopbar
