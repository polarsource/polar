'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CreatorUpsell } from '@/components/Onboarding/Creator/CreatorUpsell'
import { Goal } from '@/components/Onboarding/Creator/Goal'
import { NewsFromPolar } from '@/components/Onboarding/Creator/NewsFromPolar'
import { PostWizard } from '@/components/Onboarding/Creator/PostWizard'
import { SetupSubscriptions } from '@/components/Onboarding/Creator/SetupSubscriptions'
import {
  EarningsMetric,
  SubscribersMetric,
} from '@/components/Subscriptions/SubscriptionsMetric'
import { FlagOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useSubscriptionStatistics } from 'polarkit/hooks'
import React, { useMemo } from 'react'

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
  const subscriptionsStatistics = useSubscriptionStatistics({
    platform: organization.platform,
    orgName: organization.name,
    startDate,
    endDate,
  })

  const lastPeriod = subscriptionsStatistics.data?.periods
    ? subscriptionsStatistics.data.periods[
        subscriptionsStatistics.data?.periods.length - 1
      ]
    : undefined

  const nextSubscriberCountGoal = useMemo(() => {
    if (!lastPeriod) {
      return 10000
    }

    return (
      subscriberGoals.find((goal) => goal > lastPeriod.subscribers) ?? 10000
    )
  }, [lastPeriod])

  return (
    <DashboardBody className="flex flex-col gap-y-8 pb-24 md:gap-y-20">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-3">
        <SubscribersMetric data={lastPeriod?.subscribers ?? 0} />
        <EarningsMetric
          data={lastPeriod?.earnings ?? 0}
          hasPayoutAccount={organization.account_id !== null}
        />
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
              value={lastPeriod?.subscribers ?? 0}
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
