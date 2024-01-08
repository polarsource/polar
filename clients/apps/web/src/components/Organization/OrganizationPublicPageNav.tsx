'use client'

import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { Tabs } from 'polarkit/components/ui/tabs'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrganizationPublicPageNavProps {
  className?: string
  organization: Organization
}

export const OrganizationPublicPageNav = ({
  organization,
  className,
}: OrganizationPublicPageNavProps) => {
  const pathname = usePathname()
  const currentTab = useMemo(() => {
    const tabs = ['overview', 'subscriptions', 'issues', 'repositories']

    const pathParts = pathname.split('/')

    if (pathParts.includes('posts')) {
      return 'overview'
    } else {
      return tabs.find((tab) => pathParts.includes(tab)) ?? 'overview'
    }
  }, [pathname])

  return (
    <Tabs value={currentTab}>
      <TabsList
        className={twMerge('dark:border-polar-700 flex dark:border', className)}
      >
        <Link href={`/${organization.name}`}>
          <TabsTrigger value="overview" size="small">
            Overview
          </TabsTrigger>
        </Link>

        <Link href={`/${organization.name}/subscriptions`}>
          <TabsTrigger value="subscriptions" size="small">
            Subscriptions
          </TabsTrigger>
        </Link>

        <Link href={`/${organization.name}/issues`}>
          <TabsTrigger value="issues" size="small">
            Issues
          </TabsTrigger>
        </Link>

        <Link href={`/${organization.name}/repositories`}>
          <TabsTrigger value="repositories" size="small">
            Repositories
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  )
}
