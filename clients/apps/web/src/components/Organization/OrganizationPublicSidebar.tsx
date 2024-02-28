'use client'

import {
  ListResourceSubscriptionSummary,
  Organization,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { Avatar } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations, useSubscriptionTiers } from 'polarkit/hooks'
import { useMemo } from 'react'
import { FreeTierSubscribe } from './FreeTierSubscribe'
import { OrganizationPublicPageNav } from './OrganizationPublicPageNav'

interface OrganizationPublicSidebarProps {
  organization: Organization
  subscriptionsSummary: ListResourceSubscriptionSummary
}

export const OrganizationPublicSidebar = ({
  organization,
}: OrganizationPublicSidebarProps) => {
  const pathname = usePathname()
  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const freeSubscriptionTier = useMemo(
    () =>
      subscriptionTiers?.find(
        (tier) => tier.type === SubscriptionTierType.FREE,
      ),
    [subscriptionTiers],
  )

  const adminOrgs = useListAdminOrganizations()
  const isAdmin = useMemo(
    () =>
      adminOrgs?.data?.items?.some((org) => org.name === organization?.name),
    [adminOrgs, organization],
  )

  const isPostView = pathname.includes('/posts/')

  return (
    <div className="flex h-full flex-shrink flex-col items-start gap-y-6 ">
      <div className="flex w-full flex-row items-center gap-x-2 gap-y-12 md:flex-col md:items-start md:gap-x-0">
        <Avatar
          className="h-16 w-16 md:mb-6 md:h-64 md:w-64"
          name={organization.name}
          avatar_url={organization.avatar_url}
          height={240}
          width={240}
        />
        <div className="flex flex-col items-start md:gap-y-12">
          <div className="flex flex-col gap-y-4">
            <h1 className="dark:text-polar-50 text-xl text-gray-800 md:text-2xl">
              {organization.name}
            </h1>
            {organization.bio ? (
              <p className="dark:text-polar-500 text-start text-lg leading-relaxed text-gray-500 [text-wrap:pretty]">
                {organization.bio}
              </p>
            ) : null}
          </div>
          <div className="w-full max-w-xs">
            {freeSubscriptionTier && !isAdmin ? (
              <FreeTierSubscribe
                subscriptionTier={freeSubscriptionTier}
                organization={organization}
              />
            ) : null}
          </div>
        </div>
        <OrganizationPublicPageNav organization={organization} />
      </div>
    </div>
  )
}
