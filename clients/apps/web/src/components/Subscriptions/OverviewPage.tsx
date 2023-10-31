'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { Organization, Subscription } from '@polar-sh/sdk'
import { api } from 'polarkit'
import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  FormattedDateTime,
} from 'polarkit/components/ui/atoms'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import React, { useEffect, useMemo, useState } from 'react'
import SubscriptionTierPill from './SubscriptionTierPill'
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

  const [lastSubscriptions, setLastSubscriptions] = useState<
    Subscription[] | undefined
  >()

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

  useEffect(() => {
    api.subscriptions
      .searchSubscriptions({
        platform: organization.platform,
        organizationName: organization.name,
        limit: 5,
      })
      .then((subscriptions) => setLastSubscriptions(subscriptions.items || []))
  }, [organization])

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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-lg font-medium">Subscription Activity</div>
              <div className="dark:text-polar-500 text-gray-400">
                The last 5 subscribed users
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {lastSubscriptions !== undefined &&
                lastSubscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex flex-row items-center justify-between"
                  >
                    <div className="flex flex-row items-center justify-center gap-2">
                      <Avatar
                        avatar_url={subscription.user.avatar_url}
                        name={subscription.user.username}
                        className="h-8 w-8"
                      />
                      <div className="text-sm">
                        <div className="fw-medium">
                          {subscription.user.username}
                        </div>
                        <div className="dark:text-polar-500 text-gray-400">
                          <FormattedDateTime
                            datetime={subscription.started_at as string}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <SubscriptionTierPill
                        subscriptionTier={subscription.subscription_tier}
                        amount={subscription.price_amount}
                      />
                    </div>
                  </div>
                ))}
              {lastSubscriptions === undefined &&
                [0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={`activity-loading-${i}`} className="h-4" />
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardBody>
  )
}

export default OverviewPage
