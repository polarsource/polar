'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Organization, Subscription, SubscriptionTierType } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  FormattedDateTime,
} from 'polarkit/components/ui/atoms'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { useSubscriptionTiers } from 'polarkit/hooks'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import SubscriptionTierPill from './SubscriptionTierPill'
import SubscriptionTiersSelect from './SubscriptionTiersSelect'
import {
  MRRChart,
  ParsedSubscriptionsStatisticsPeriod,
  SubscribersChart,
} from './SubscriptionsChart'
import {
  CumulativeRevenueMetric,
  MRRMetric,
  SubscribersMetric,
} from './SubscriptionsMetric'
import { getSubscriptionTiersByType } from './utils'

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
  const subscriptionTiers = useSubscriptionTiers(organization.name)
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.data?.items ?? []),
    [subscriptionTiers.data],
  )

  const router = useRouter()
  const onFilterChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams()
      if (value !== 'all') {
        if (Object.values(SubscriptionTierType).includes(value as any)) {
          params.append('type', value)
        } else {
          params.append('subscription_tier_id', value)
        }
      }
      router.push(
        `/maintainer/${organization.name}/subscriptions?${params.toString()}`,
      )
    },
    [router, organization],
  )

  const apiQueryParams = useMemo(() => {
    return {
      ...(subscriptionTierId ? { subscriptionTierId } : {}),
      ...(subscriptionTierType ? { type: subscriptionTierType } : {}),
    }
  }, [subscriptionTierId, subscriptionTierType])

  const [statisticsPeriods, setStatisticsPeriods] = useState<
    ParsedSubscriptionsStatisticsPeriod[]
  >([])
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()
  const displayedPeriod = useMemo(() => {
    if (statisticsPeriods.length === 0) {
      return undefined
    }

    if (hoveredPeriodIndex !== undefined) {
      return statisticsPeriods[hoveredPeriodIndex]
    }

    return statisticsPeriods[statisticsPeriods.length - 1]
  }, [statisticsPeriods, hoveredPeriodIndex])
  const previousPeriod = useMemo(() => {
    if (statisticsPeriods.length === 0) {
      return undefined
    }

    return statisticsPeriods[statisticsPeriods.length - 2]
  }, [statisticsPeriods])

  const [lastSubscriptions, setLastSubscriptions] = useState<
    Subscription[] | undefined
  >()

  useEffect(() => {
    setStatisticsPeriods([])
    api.subscriptions
      .getSubscriptionsStatistics({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        platform: organization.platform,
        organizationName: organization.name,
        ...apiQueryParams,
      })
      .then((summary) => {
        setStatisticsPeriods(
          summary.periods.map((period) => ({
            ...period,
            parsedStartDate: new Date(period.start_date),
          })),
        )
      })
  }, [startDate, endDate, organization, apiQueryParams])

  useEffect(() => {
    setLastSubscriptions(undefined)
    api.subscriptions
      .searchSubscriptions({
        platform: organization.platform,
        organizationName: organization.name,
        limit: 5,
        ...apiQueryParams,
      })
      .then((subscriptions) => setLastSubscriptions(subscriptions.items || []))
  }, [organization, apiQueryParams])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Overview</h2>
          <div className="w-full md:w-1/6">
            <SubscriptionTiersSelect
              tiersByType={subscriptionTiersByType}
              value={subscriptionTierType || subscriptionTierId || 'all'}
              onChange={onFilterChange}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {statisticsPeriods.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <div className="text-lg font-medium">Subscribers</div>
                </CardHeader>
                <CardContent>
                  <SubscribersChart
                    data={statisticsPeriods}
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
                    data={statisticsPeriods}
                    onDataIndexHover={setHoveredPeriodIndex}
                    hoveredIndex={hoveredPeriodIndex}
                  />
                </CardContent>
              </Card>
            </>
          )}
          {statisticsPeriods.length === 0 &&
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
                      <div className="flex flex-col text-sm">
                        <div className="font-medium">
                          {subscription.user.username}
                        </div>
                        <div className="dark:text-polar-500 text-xs text-gray-400">
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
