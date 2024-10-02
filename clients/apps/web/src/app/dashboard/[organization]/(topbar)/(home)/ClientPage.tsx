'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { ActivityWidget } from '@/components/Widgets/ActivityWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import { RevenueWidget } from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
        <ActivityWidget className="col-span-2" />
        <OrdersWidget />
        <RevenueWidget />
        <SubscribersWidget />
        <AccountWidget />
      </div>
    </DashboardBody>
  )
}

export default OverviewPage
