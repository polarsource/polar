'use client'

import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import { useListAdminOrganizations } from 'polarkit/hooks'
import React, { useMemo } from 'react'

interface OrganizationSubscriptionsPublicPageProps {
  subscriptionTiers: SubscriptionTier[]
  organization: Organization
}

const ClientPage: React.FC<OrganizationSubscriptionsPublicPageProps> = ({
  subscriptionTiers,
  organization,
}) => {
  useTrafficRecordPageView({ organization })

  const orgs = useListAdminOrganizations()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.data?.items?.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Subscriptions</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Support {organization.name} with a subscription and receive unique
          benefits in return
        </p>
      </div>
      <div className="flex flex-row flex-wrap gap-8">
        {subscriptionTiers.map((tier) => (
          <SubscriptionTierCard
            className="w-full self-stretch md:max-w-[238px]"
            key={tier.id}
            subscriptionTier={tier}
          >
            {shouldRenderSubscribeButton &&
              (tier.type === 'free' ? (
                <FreeTierSubscribe
                  subscriptionTier={tier}
                  organization={organization}
                />
              ) : (
                <SubscriptionTierSubscribeButton
                  organization={organization}
                  subscriptionTier={tier}
                  subscribePath="/api/subscribe"
                />
              ))}
          </SubscriptionTierCard>
        ))}
      </div>
    </div>
  )
}

export default ClientPage
