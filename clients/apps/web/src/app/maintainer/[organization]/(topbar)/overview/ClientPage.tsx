'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CreatorUpsell } from '@/components/Onboarding/Creator/CreatorUpsell'
import { NewsFromPolar } from '@/components/Onboarding/Creator/NewsFromPolar'
import { PostWizard } from '@/components/Onboarding/Creator/PostWizard'
import { SetupSubscriptions } from '@/components/Onboarding/Creator/SetupSubscriptions'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { ActivityWidget } from '@/components/Widgets/ActivityWidget'
import { MRRWidget } from '@/components/Widgets/MRRWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import { RevenueWidget } from '@/components/Widgets/RevenueWidget'
import { Organization } from '@polar-sh/sdk'
import React from 'react'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

const OverviewPage: React.FC<OverviewPageProps> = ({}) => {
  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-20">
      <div className="hidden grid-cols-1 gap-10 md:grid md:grid-cols-3">
        <ActivityWidget className="col-span-2" />
        <OrdersWidget />
        <RevenueWidget />
        <MRRWidget />
        <AccountWidget />
      </div>

      <CreatorUpsell />
      <PostWizard />
      <SetupSubscriptions />
      <NewsFromPolar />
    </DashboardBody>
  )
}

export default OverviewPage
