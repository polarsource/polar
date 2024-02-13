'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  MRRMetric,
  SubscribersMetric,
} from '@/components/Subscriptions/SubscriptionsMetric'
import { DiamondOutlined } from '@mui/icons-material'
import { Organization, SubscriptionsStatisticsPeriod } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { Card, CardContent, CardHeader } from 'polarkit/components/ui/atoms'
import React, { useEffect, useState } from 'react'
import { CreatorUpsell } from './CreatorUpsell'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  organization,
  startDate,
  endDate,
}) => {
  const [statisticsPeriods, setStatisticsPeriods] =
    useState<SubscriptionsStatisticsPeriod>()

  useEffect(() => {
    api.subscriptions
      .getSubscriptionsStatistics({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        platform: organization.platform,
        organizationName: organization.name,
      })
      .then((summary) => {
        // Empty stats, generate demo data
        if (
          summary.periods.every(
            (period) =>
              period.subscribers === 0 &&
              period.mrr === 0 &&
              period.cumulative === 0,
          )
        ) {
          return
        }

        setStatisticsPeriods(summary.periods[summary.periods.length - 1])
      })
  }, [endDate, organization, startDate])

  if (!statisticsPeriods) return null

  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-16">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <SubscribersMetric
          data={statisticsPeriods.subscribers}
          dataDate={new Date()}
        />
        <MRRMetric data={statisticsPeriods.mrr} dataDate={new Date()} />
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="font-medium">Goal</div>
            <span className="text-blue-500">
              <DiamondOutlined className="h-4 w-4" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-5xl !font-light">Hello</div>
          </CardContent>
        </Card>
      </div>
      <CreatorUpsell />
    </DashboardBody>
  )
}

export default OverviewPage
