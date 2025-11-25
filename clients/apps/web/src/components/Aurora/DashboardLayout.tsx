'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import { PropsWithChildren, useContext, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { DashboardProvider } from '../Dashboard/DashboardProvider'
import { DashboardNavigation } from './DashboardNavigation'

const AuroraDashboardLayout = (
  props: PropsWithChildren<{
    type?: 'organization' | 'account'
    className?: string
  }>,
) => {
  const { organization } = useContext(OrganizationContext)

  useEffect(() => {
    if (organization) {
      setLastVisitedOrg(organization.slug)
    }
  }, [organization])

  return (
    <DashboardProvider organization={organization}>
      <div className="relative flex h-full w-full flex-col bg-white md:flex-row md:bg-gray-100 dark:bg-transparent">
        <div
          className={twMerge(
            'relative flex h-full w-full flex-col',
            props.className,
          )}
        >
          <DashboardNavigation />
          <main className="relative flex min-h-0 min-w-0 grow flex-col overflow-y-auto">
            {props.children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}

export default AuroraDashboardLayout
