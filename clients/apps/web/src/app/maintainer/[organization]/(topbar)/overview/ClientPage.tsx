'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Goal } from '@/components/Onboarding/Creator/Goal'
import { NewsFromPolar } from '@/components/Onboarding/Creator/NewsFromPolar'
import { PostWizard } from '@/components/Onboarding/Creator/PostWizard'
import { SetupSubscriptions } from '@/components/Onboarding/Creator/SetupSubscriptions'
import {
  EarningsMetric,
  SubscribersMetric,
} from '@/components/Subscriptions/SubscriptionsMetric'
import { FlagOutlined } from '@mui/icons-material'
import { Organization, SubscriptionsStatisticsPeriod } from '@polar-sh/sdk'
import { api } from 'polarkit'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import React, { useEffect, useMemo, useState } from 'react'
import { CreatorUpsell } from '../../../../../components/Onboarding/Creator/CreatorUpsell'

const subscriberGoals = [5, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]

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
            (period) => period.subscribers === 0 && period.earnings === 0,
          )
        ) {
          return
        }

        setStatisticsPeriods(summary.periods[summary.periods.length - 1])
      })
  }, [endDate, organization, startDate])

  const nextSubscriberCountGoal = useMemo(() => {
    return (
      subscriberGoals.find(
        (goal) => goal > (statisticsPeriods?.subscribers ?? 0),
      ) ?? 10000
    )
  }, [statisticsPeriods])

  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-20">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3">
        <SubscribersMetric data={statisticsPeriods?.subscribers ?? 0} />
        <EarningsMetric data={statisticsPeriods?.earnings ?? 0} />
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="font-medium">Goal</div>
            <span className="text-blue-500">
              <FlagOutlined className="h-6 w-6" />
            </span>
          </CardHeader>
          <CardContent>
            <Goal
              title="Subscribers"
              value={statisticsPeriods?.subscribers ?? 0}
              max={nextSubscriberCountGoal}
            />
          </CardContent>
        </Card>
      </div>
      <CreatorUpsell />
      <PostWizard />
      <SetupSubscriptions />
      <NewsFromPolar />
    </DashboardBody>
  )
}

export default OverviewPage
