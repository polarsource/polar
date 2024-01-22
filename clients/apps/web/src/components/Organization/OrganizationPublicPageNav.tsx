'use client'

import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Tabs } from 'polarkit/components/ui/tabs'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrganizationPublicPageNavProps {
  className?: string
  organization: Organization
  mobileLayout?: boolean
}

export const OrganizationPublicPageNav = ({
  organization,
  className,
  mobileLayout = false,
}: OrganizationPublicPageNavProps) => {
  const router = useRouter()
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

  const handleSelectChange = useCallback(
    (value: string) => {
      const path = value === 'overview' ? '' : value
      router.push(`/${organization.name}/${path}`)
    },
    [organization, router],
  )

  return mobileLayout ? (
    <Select value={currentTab} onValueChange={handleSelectChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a tier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="overview">Overview</SelectItem>
        <SelectItem value="subscriptions">Subscriptions</SelectItem>
        <SelectItem value="issues">Issues</SelectItem>
        <SelectItem value="repositories">Repositories</SelectItem>
      </SelectContent>
    </Select>
  ) : (
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
