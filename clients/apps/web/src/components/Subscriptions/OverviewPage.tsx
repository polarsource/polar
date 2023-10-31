'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { Organization } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { Card, CardContent, CardHeader } from 'polarkit/components/ui/atoms'
import { Skeleton } from 'polarkit/components/ui/skeleton'
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

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {displayedPeriod && (
            <>
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
            </>
          )}
          {!displayedPeriod &&
            [0, 1, 2].map((i) => (
              <Card key={`metric-loading-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-1/4" />
                  <Skeleton className="mt-4 h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {summaryPeriods.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <div className="text-lg font-medium">Subscribers</div>
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
                  <div className="text-lg font-medium">
                    Monthly recurring revenue
                  </div>
                </CardHeader>
                <CardContent>
                  <MRRChart
                    data={summaryPeriods}
                    onDataIndexHover={setHoveredPeriodIndex}
                    hoveredIndex={hoveredPeriodIndex}
                  />
                </CardContent>
              </Card>
            </>
          )}
          {summaryPeriods.length === 0 &&
            [0, 1].map((i) => (
              <Card key={`chart-loading-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </DashboardBody>
  )
}

export default OverviewPage
