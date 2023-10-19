'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  ListResourceSubscriptionTier,
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import React, { useMemo } from 'react'
import SubscriptionGroup from './SubscriptionGroup'
import { getSubscriptionTiersByType } from './utils'

type SubscriptionTiersByType = {
  [key in SubscriptionTierType]: SubscriptionTier[]
}

interface TiersPageProps {
  subscriptionTiers: ListResourceSubscriptionTier
  organization: Organization
}

const defaultSubscriptionTiersByType: SubscriptionTiersByType = {
  [SubscriptionTierType.HOBBY]: [],
  [SubscriptionTierType.PRO]: [],
  [SubscriptionTierType.BUSINESS]: [],
}

const TiersPage: React.FC<TiersPageProps> = ({
  subscriptionTiers,
  organization,
}) => {
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.items ?? []),
    [subscriptionTiers],
  )

  return (
    <DashboardBody>
      <div className="dark:divide-polar-700 flex flex-col gap-4 divide-y">
        <SubscriptionGroup
          title="Hobby"
          description="Tiers for individuals & fans who want to say thanks"
          type={SubscriptionTierType.HOBBY}
          tiers={subscriptionTiersByType.hobby}
          organization={organization}
        />
        <SubscriptionGroup
          title="Pro"
          description="Tiers best suited for indie hackers & startups"
          type={SubscriptionTierType.PRO}
          tiers={subscriptionTiersByType?.pro}
          organization={organization}
        />
        <SubscriptionGroup
          title="Business"
          description="Your most exclusive tiers for business customers"
          type={SubscriptionTierType.BUSINESS}
          tiers={subscriptionTiersByType?.business}
          organization={organization}
        />
      </div>
    </DashboardBody>
  )
}

export default TiersPage
