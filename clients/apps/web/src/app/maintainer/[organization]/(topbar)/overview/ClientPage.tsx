'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import React from 'react'
import { CreatorUpsell } from './CreatorUpsell'
import SubscriptionsOverview from './SubscriptionsOverview'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
  subscriptionTierId?: string
  subscriptionTierType?: SubscriptionTierType
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  organization,
  startDate,
  endDate,
  subscriptionTierId,
  subscriptionTierType,
}) => {
  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-16">
      <CreatorUpsell />
      <SubscriptionsOverview
        organization={organization}
        startDate={startDate}
        endDate={endDate}
        subscriptionTierId={subscriptionTierId}
        subscriptionTierType={subscriptionTierType}
      />
    </DashboardBody>
  )
}

export default OverviewPage
