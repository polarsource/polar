'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import React from 'react'
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
    <DashboardBody>
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
