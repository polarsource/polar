'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { ListResourceSubscriptionTier, Organization } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { Card, CardContent, CardHeader } from 'polarkit/components/ui/card'
import React, { useEffect, useMemo, useState } from 'react'
import {
  MRRChart,
  ParsedSubscriptionsSummaryPeriod,
  SubscribersChart,
} from './SubscriptionsChart'
import {
  CumulativeRevenueMetric,
  MRRMetric,
  SubscribersMetric,
} from './SubscriptionsMetric'
import { getSubscriptionTiersByType } from './utils'

interface OverviewPageProps {
  subscriptionTiers: ListResourceSubscriptionTier
  organization: Organization
  startDate: Date
  endDate: Date
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  subscriptionTiers,
  organization,
  startDate,
  endDate,
}) => {
  const [summaryPeriods, setSummaryPeriods] = useState<
    ParsedSubscriptionsSummaryPeriod[]
  >([])
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()
  const displayedPeriod = useMemo(() => {
    if (summaryPeriods.length === 0) {
      return undefined
    }

    if (hoveredPeriodIndex !== undefined) {
      return summaryPeriods[hoveredPeriodIndex]
    }

    return summaryPeriods[summaryPeriods.length - 1]
  }, [summaryPeriods, hoveredPeriodIndex])
  const previousPeriod = useMemo(() => {
    if (summaryPeriods.length === 0) {
      return undefined
    }

    return summaryPeriods[summaryPeriods.length - 2]
  }, [summaryPeriods])

  useEffect(() => {
    api.subscriptions
      .getSubscriptionsSummary({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        platform: organization.platform,
        organizationName: organization.name,
      })
      .then((summary) => {
        setSummaryPeriods(
          summary.periods.map((period) => ({
            ...period,
            parsedStartDate: new Date(period.start_date),
          })),
        )
      })
  }, [startDate, endDate, organization])

  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.items ?? []),
    [subscriptionTiers],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-4">
        {displayedPeriod && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SubscribersMetric
              data={displayedPeriod.subscribers}
              dataDate={displayedPeriod.parsedStartDate}
              previousData={
                !hoveredPeriodIndex && previousPeriod
                  ? previousPeriod.subscribers
                  : undefined
              }
            />
            <MRRMetric
              data={displayedPeriod.mrr}
              dataDate={displayedPeriod.parsedStartDate}
              previousData={
                !hoveredPeriodIndex && previousPeriod
                  ? previousPeriod.mrr
                  : undefined
              }
            />
            <CumulativeRevenueMetric
              data={displayedPeriod.cumulative}
              dataDate={displayedPeriod.parsedStartDate}
              previousData={
                !hoveredPeriodIndex && previousPeriod
                  ? previousPeriod.cumulative
                  : undefined
              }
            />
          </div>
        )}
        {summaryPeriods.length && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="text-xl">Subscribers</div>
              </CardHeader>
              <CardContent>
                <SubscribersChart
                  data={summaryPeriods}
                  onDataIndexHover={setHoveredPeriodIndex}
                  hoveredIndex={hoveredPeriodIndex}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-xl">Monthly recurring revenue</div>
              </CardHeader>
              <CardContent>
                <MRRChart
                  data={summaryPeriods}
                  onDataIndexHover={setHoveredPeriodIndex}
                  hoveredIndex={hoveredPeriodIndex}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}

export default OverviewPage
