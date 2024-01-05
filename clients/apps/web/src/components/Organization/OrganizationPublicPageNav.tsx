'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { twMerge } from 'tailwind-merge'

interface OrganizationPublicPageNavProps {
  className?: string
  organization: Organization
}

export const OrganizationPublicPageNav = ({
  organization,
  className,
}: OrganizationPublicPageNavProps) => {
  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const paidTiers = subscriptionTiers?.filter((tier) => tier.type !== 'free')
  const shouldRenderSubscriptionsTab = (paidTiers?.length ?? 0) > 0

  return (
    <TabsList
      className={twMerge('dark:border-polar-700 flex dark:border', className)}
    >
      <Link href={`/${organization.name}`}>
        <TabsTrigger value="overview" size="small">
          Overview
        </TabsTrigger>
      </Link>
      {isFeatureEnabled('subscriptions') && shouldRenderSubscriptionsTab && (
        <Link href={`/${organization.name}/subscriptions`}>
          <TabsTrigger value="subscriptions" size="small">
            Subscriptions
          </TabsTrigger>
        </Link>
      )}
      {isFeatureEnabled('feed') && (
        <Link href={`/${organization.name}/issues`}>
          <TabsTrigger value="issues" size="small">
            Issues
          </TabsTrigger>
        </Link>
      )}
      <Link href={`/${organization.name}/repositories`}>
        <TabsTrigger value="repositories" size="small">
          Repositories
        </TabsTrigger>
      </Link>
    </TabsList>
  )
}
