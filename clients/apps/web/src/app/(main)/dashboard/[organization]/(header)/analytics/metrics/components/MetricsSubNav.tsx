'use client'

import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

interface Tab {
  title: string
  href: string
  visible: boolean
}

interface MetricsSubNavProps {
  organization: schemas['Organization']
  hasRecurringProducts: boolean
  hasOneTimeProducts: boolean
}

export function MetricsSubNav({
  organization,
  hasRecurringProducts,
  hasOneTimeProducts,
}: MetricsSubNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = `/dashboard/${organization.slug}/analytics/metrics`

  const tabs = useMemo(() => {
    const allTabs: Tab[] = [
      {
        title: 'Subscriptions',
        href: `${basePath}/subscriptions`,
        visible: hasRecurringProducts,
      },
      {
        title: 'Cancellations',
        href: `${basePath}/cancellations`,
        visible: hasRecurringProducts,
      },
      {
        title: 'One-time',
        href: `${basePath}/one-time`,
        visible: hasOneTimeProducts,
      },
      {
        title: 'Orders',
        href: `${basePath}/orders`,
        visible: true,
      },
      {
        title: 'Checkouts',
        href: `${basePath}/checkouts`,
        visible: true,
      },
      {
        title: 'Net Revenue',
        href: `${basePath}/net-revenue`,
        visible: true,
      },
      {
        title: 'Costs',
        href: `${basePath}/costs`,
        visible: organization.feature_settings?.revops_enabled ?? false,
      },
    ]
    return allTabs.filter((tab) => tab.visible)
  }, [
    basePath,
    hasRecurringProducts,
    hasOneTimeProducts,
    organization.feature_settings?.revops_enabled,
  ])

  const currentTab = tabs.find(
    (tab) => pathname === tab.href || pathname.startsWith(tab.href + '/'),
  )

  const queryString = searchParams.toString()

  const handleSelectChange = (href: string) => {
    const url = queryString ? `${href}?${queryString}` : href
    router.push(url)
  }

  const [breakpointHidden, breakpointBlock] = useMemo(() => {
    if (!hasRecurringProducts && !hasOneTimeProducts) {
      return ['@sm:hidden', '@sm:block']
    }

    if (
      hasRecurringProducts &&
      hasOneTimeProducts &&
      organization.feature_settings?.revops_enabled
    ) {
      return ['@3xl:hidden', '@3xl:block']
    }

    if (hasRecurringProducts || organization.feature_settings?.revops_enabled) {
      return ['@2xl:hidden', '@2xl:block']
    }

    return ['@lg:hidden', '@lg:block']
  }, [
    hasRecurringProducts,
    hasOneTimeProducts,
    organization.feature_settings?.revops_enabled,
  ])

  return (
    <div className="@container w-full">
      <div className={`w-full ${breakpointHidden}`}>
        <Select value={currentTab?.href} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.title} value={tab.href}>
                {tab.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`hidden ${breakpointBlock}`}>
        <Tabs className="-mx-4.5" value={currentTab?.title}>
          <TabsList className="flex flex-row flex-wrap justify-start bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {tabs.map((tab) => {
              const href = queryString ? `${tab.href}?${queryString}` : tab.href
              return (
                <Link key={tab.title} href={href} prefetch={true}>
                  <TabsTrigger
                    className="flex flex-row items-center gap-x-2 px-4"
                    value={tab.title}
                  >
                    {tab.title}
                  </TabsTrigger>
                </Link>
              )
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
