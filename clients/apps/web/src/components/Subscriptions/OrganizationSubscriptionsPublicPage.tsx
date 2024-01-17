'use client'

import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import React, { useMemo } from 'react'
import SubscriptionGroupPublic from './SubscriptionGroupPublic'
import { getSubscriptionTiersByType } from './utils'

interface OrganizationSubscriptionsPublicPageProps {
  subscriptionTiers: SubscriptionTier[]
  organization: Organization
}

const OrganizationSubscriptionsPublicPage: React.FC<
  OrganizationSubscriptionsPublicPageProps
> = ({ subscriptionTiers, organization }) => {
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers ?? []),
    [subscriptionTiers],
  )

  return (
    <div className="flex flex-col">
      <div className="dark:divide-polar-700 flex flex-col divide-y">
        <SubscriptionGroupPublic
          title="Free"
          description="Baseline tier giving access to public posts"
          type={SubscriptionTierType.FREE}
          tiers={subscriptionTiersByType.free}
          organization={organization}
          subscribePath="/subscribe"
        />
        <SubscriptionGroupPublic
          title="Individual"
          description="Tiers for individuals & fans who want to say thanks"
          type={SubscriptionTierType.INDIVIDUAL}
          tiers={subscriptionTiersByType.individual}
          organization={organization}
          subscribePath="/subscribe"
        />
        <SubscriptionGroupPublic
          title="Business"
          description="The most exclusive tiers for business customers"
          type={SubscriptionTierType.BUSINESS}
          tiers={subscriptionTiersByType?.business}
          organization={organization}
          subscribePath="/subscribe"
        />
      </div>
    </div>
  )
}

export default OrganizationSubscriptionsPublicPage
