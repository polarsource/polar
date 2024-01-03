'use client'

import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col"
    >
      <h2 className="text-lg">Subscriptions</h2>
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
          title="Hobby"
          description="Tiers for individuals & fans who want to say thanks"
          type={SubscriptionTierType.HOBBY}
          tiers={subscriptionTiersByType.hobby}
          organization={organization}
          subscribePath="/subscribe"
        />
        <SubscriptionGroupPublic
          title="Pro"
          description="Tiers best suited for indie hackers & startups"
          type={SubscriptionTierType.PRO}
          tiers={subscriptionTiersByType?.pro}
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
    </motion.div>
  )
}

export default OrganizationSubscriptionsPublicPage
