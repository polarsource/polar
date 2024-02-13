'use client'

import SubscriptionTierPill from '@/components/Subscriptions/SubscriptionTierPill'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import {
  MRRChart,
  ParsedSubscriptionsStatisticsPeriod,
  SubscribersChart,
} from '@/components/Subscriptions/SubscriptionsChart'
import {
  CumulativeRevenueMetric,
  MRRMetric,
  SubscribersMetric,
} from '@/components/Subscriptions/SubscriptionsMetric'
import { getSubscriptionTiersByType } from '@/components/Subscriptions/utils'
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
import { twMerge } from 'tailwind-merge'

const generateDemoStats = (
  periods: { start_date: string; end_date: string; parsedStartDate: Date }[],
  growthRate: number = 0.8,
  noiseFactor: number = 0.2,
  initialSubscribers: number = 100,
  initialMRR: number = 150000,
  initialCumulative: number = 150000,
): ParsedSubscriptionsStatisticsPeriod[] => {
  const data: ParsedSubscriptionsStatisticsPeriod[] = []
  let cumulative = initialCumulative

  for (let i = 0; i < periods.length; i++) {
    const sigmoidValue =
      1 / (1 + Math.exp(-growthRate * (i - periods.length / 2)))
    const randomFactor = 1 + (Math.random() - 0.5) * noiseFactor
    const mrr = Math.floor(initialMRR * sigmoidValue * randomFactor)
    data.push({
      start_date: periods[i].start_date,
      parsedStartDate: periods[i].parsedStartDate,
      end_date: periods[i].end_date,
      subscribers: Math.floor(initialSubscribers * sigmoidValue * randomFactor),
      mrr,
      cumulative,
    })
    cumulative += mrr
  }

  return data
}

interface SubscriptionsOverviewProps {
  organization: Organization
  startDate: Date
  endDate: Date
  subscriptionTierId?: string
  subscriptionTierType?: SubscriptionTierType
}

const SubscriptionsOverview: React.FC<SubscriptionsOverviewProps> = ({
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
        `/maintainer/${organization.name}/overview?${params.toString()}`,
      )
    },
    [router, organization],
  )

  const apiQueryParams = useMemo(() => {
    return {
      ...(subscriptionTierId ? { subscriptionTierId } : {}),
      ...(subscriptionTierType ? { types: [subscriptionTierType] } : {}),
    }
  }, [subscriptionTierId, subscriptionTierType])

  const [statisticsPeriods, setStatisticsPeriods] = useState<
    ParsedSubscriptionsStatisticsPeriod[]
  >([])
  const [isDemoData, setIsDemoData] = useState(false)

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
        const statisticsPeriods = summary.periods.map((period) => ({
          ...period,
          parsedStartDate: new Date(period.start_date),
        }))

        // Empty stats, generate demo data
        if (
          statisticsPeriods.every(
            (period) =>
              period.subscribers === 0 &&
              period.mrr === 0 &&
              period.cumulative === 0,
          )
        ) {
          setStatisticsPeriods(generateDemoStats(statisticsPeriods))
          setIsDemoData(true)
        } else {
          setStatisticsPeriods(statisticsPeriods)
          setIsDemoData(false)
        }
      })
  }, [startDate, endDate, organization, apiQueryParams])

  useEffect(() => {
    setLastSubscriptions(undefined)
    api.subscriptions
      .searchSubscriptions({
        platform: organization.platform,
        organizationName: organization.name,
        active: true,
        limit: 5,
        ...apiQueryParams,
      })
      .then((subscriptions) => setLastSubscriptions(subscriptions.items || []))
  }, [organization, apiQueryParams])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">Subscriptions</h2>
        <div className="w-1/3 md:w-1/5">
          <SubscriptionTiersSelect
            tiersByType={subscriptionTiersByType}
            value={subscriptionTierType || subscriptionTierId || 'all'}
            onChange={onFilterChange}
          />
        </div>
      </div>
      <div
        className={twMerge(
          'grid grid-cols-1 gap-6 md:grid-cols-3',
          isDemoData ? 'opacity-50' : '',
        )}
      >
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
      <div
        className={twMerge(
          'grid grid-cols-1 gap-6 md:grid-cols-2',
          isDemoData ? 'opacity-50' : '',
        )}
      >
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
      {(lastSubscriptions?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-lg font-medium">Subscription Activity</div>
              <div className="dark:text-polar-500 text-gray-400">
                The last 5 subscribers
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
                        avatar_url={
                          subscription.organization
                            ? subscription.organization.avatar_url
                            : subscription.user.avatar_url
                        }
                        name={
                          subscription.organization
                            ? subscription.organization.name
                            : subscription.user.public_name
                        }
                        className="h-8 w-8"
                      />
                      <div className="flex flex-col text-sm">
                        {subscription.organization ? (
                          <div className="font-medium">
                            {subscription.organization.name}
                          </div>
                        ) : (
                          <>
                            {subscription.user.github_username ? (
                              <>
                                <div className="font-medium">
                                  {subscription.user.github_username}
                                </div>
                                <div className="dark:text-polar-500 text-xs text-gray-400">
                                  {subscription.user.email}
                                </div>
                              </>
                            ) : (
                              <div className="font-medium">
                                {subscription.user.email}
                              </div>
                            )}
                          </>
                        )}

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
      )}
      {isDemoData && (
        <p className="text-muted-foreground text-center text-sm">
          Demonstration data. Get your first subscribers to unlock your
          statistics!
        </p>
      )}
    </div>
  )
}

export default SubscriptionsOverview
