'use client'

import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Separator } from 'polarkit/components/ui/separator'
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
    <div className="dark:divide-polar-700 flex flex-col gap-12">
      <SubscriptionGroupPublic
        title="Hobby"
        description="Tiers for individuals & fans who want to say thanks"
        type={SubscriptionTierType.HOBBY}
        tiers={subscriptionTiersByType.hobby}
        subscribePath="/subscribe"
      />
      <Separator />
      <SubscriptionGroupPublic
        title="Pro"
        description="Tiers best suited for indie hackers & startups"
        type={SubscriptionTierType.PRO}
        tiers={subscriptionTiersByType?.pro}
        subscribePath="/subscribe"
      />
      <Separator />
      <SubscriptionGroupPublic
        title="Business"
        description="Your most exclusive tiers for business customers"
        type={SubscriptionTierType.BUSINESS}
        tiers={subscriptionTiersByType?.business}
        subscribePath="/subscribe"
      />
    </div>
  )
}

export default OrganizationSubscriptionsPublicPage
