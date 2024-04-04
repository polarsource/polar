'use client'

import NoPayoutAccountTooltip from '@/components/Subscriptions/NoPayoutAccountTooltip'
import SubscriptionTierPill from '@/components/Subscriptions/SubscriptionTierPill'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import {
  EarningsChart,
  ParsedSubscriptionsStatisticsPeriod,
  SubscribersChart,
} from '@/components/Subscriptions/SubscriptionsChart'
import {
  EarningsMetric,
  SubscribersMetric,
} from '@/components/Subscriptions/SubscriptionsMetric'
import {
  getSubscriptionTiersByType,
  tiersTypeDisplayNames,
} from '@/components/Subscriptions/utils'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import {
  useSearchSubscriptions,
  useSubscriptionStatistics,
  useSubscriptionTiers,
} from 'polarkit/hooks'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const generateDemoStats = (
  periods: { start_date: string; end_date: string; parsedStartDate: Date }[],
  growthRate: number = 0.8,
  noiseFactor: number = 0.2,
  initialSubscribers: number = 100,
  initialEarnings: number = 150000,
): ParsedSubscriptionsStatisticsPeriod[] => {
  const data: ParsedSubscriptionsStatisticsPeriod[] = []
  for (let i = 0; i < periods.length; i++) {
    const sigmoidValue =
      1 / (1 + Math.exp(-growthRate * (i - periods.length / 2)))
    const randomFactor = 1 + (Math.random() - 0.5) * noiseFactor
    data.push({
      start_date: periods[i].start_date,
      parsedStartDate: periods[i].parsedStartDate,
      end_date: periods[i].end_date,
      subscribers: Math.floor(initialSubscribers * sigmoidValue * randomFactor),
      earnings: Math.floor(initialEarnings * sigmoidValue * randomFactor),
    })
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

const ClientPage: React.FC<SubscriptionsOverviewProps> = ({
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
        `/maintainer/${
          organization.name
        }/subscriptions/overview?${params.toString()}`,
      )
    },
    [router, organization],
  )

  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()

  const statisticsAllTiersAndTypes = useSubscriptionStatistics({
    startDate,
    endDate,
    platform: organization.platform,
    orgName: organization.name,
  })

  const haveHadSubscribers = useMemo(() => {
    const s = statisticsAllTiersAndTypes.data?.periods ?? []
    return s.some((p) => p.earnings > 0 || p.subscribers > 0)
  }, [statisticsAllTiersAndTypes])

  const statistics = useSubscriptionStatistics({
    startDate,
    endDate,
    platform: organization.platform,
    orgName: organization.name,
    subscriptionTierId,
    ...(subscriptionTierType ? { tierTypes: [subscriptionTierType] } : {}),
  })

  const periods = statistics?.data?.periods ?? []

  const realStatisticsPeriods: ParsedSubscriptionsStatisticsPeriod[] = useMemo(
    () =>
      periods.map((p) => {
        return { ...p, parsedStartDate: new Date(p.start_date) }
      }),
    [periods],
  )

  const statisticsPeriods = useMemo(
    () =>
      haveHadSubscribers
        ? realStatisticsPeriods
        : generateDemoStats(realStatisticsPeriods),
    [haveHadSubscribers, realStatisticsPeriods],
  )

  const isDemoData =
    !haveHadSubscribers &&
    statistics.isFetched &&
    statisticsAllTiersAndTypes.isFetched

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

  const lastSubscriptionsHook = useSearchSubscriptions({
    platform: organization.platform,
    organizationName: organization.name,
    active: true,
    limit: 5,
    page: 1,
    subscriptionTierId,
    type: subscriptionTierType,
  })

  const lastSubscriptions = lastSubscriptionsHook.data?.items ?? []

  const selectedSingleTier = subscriptionTierId
    ? subscriptionTiers.data?.items?.find((t) => t.id === subscriptionTierId)
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">Overview</h2>
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
          'grid grid-cols-1 gap-6 lg:grid-cols-2',
          isDemoData ? 'opacity-50' : '',
        )}
      >
        {displayedPeriod && (
          <>
            <SubscribersMetric
              data={displayedPeriod.subscribers}
              dataDate={displayedPeriod.parsedStartDate}
              previousData={
                hoveredPeriodIndex === undefined && previousPeriod
                  ? previousPeriod.subscribers
                  : undefined
              }
            />
            <EarningsMetric
              data={displayedPeriod.earnings}
              dataDate={displayedPeriod.parsedStartDate}
              previousData={
                hoveredPeriodIndex === undefined && previousPeriod
                  ? previousPeriod.earnings
                  : undefined
              }
              hasPayoutAccount={organization.account_id !== null}
            />
          </>
        )}
        {!displayedPeriod &&
          [0, 1].map((i) => (
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
          'grid grid-cols-1 gap-6 lg:grid-cols-2',
          isDemoData ? 'opacity-50' : '',
        )}
      >
        {statisticsPeriods.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <div className="font-medium">Subscribers</div>
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
                <div className="inline-flex gap-2">
                  <div className="font-medium">Earnings</div>
                  {organization.account_id === null ? (
                    <NoPayoutAccountTooltip />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <EarningsChart
                  data={statisticsPeriods}
                  onDataIndexHover={setHoveredPeriodIndex}
                  hoveredIndex={hoveredPeriodIndex}
                />
              </CardContent>
            </Card>
          </>
        )}
        {statisticsPeriods.length === 0
          ? [0, 1].map((i) => (
              <Card key={`chart-loading-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
            ))
          : null}
      </div>

      {!isDemoData && lastSubscriptionsHook.isFetched ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-lg font-medium">Subscription Activity</div>
              <div className="dark:text-polar-500 text-gray-400">
                The last 5 subscribers
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {lastSubscriptions.length > 0 ? (
                <>
                  {lastSubscriptions.map((subscription) => (
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
                          price={subscription.price}
                        />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="dark:text-polar-500 text-sm text-gray-400">
                    {subscriptionTierType
                      ? ` You don't have any
                    ${tiersTypeDisplayNames[subscriptionTierType]} subscribers,
                    yet!`
                      : selectedSingleTier
                        ? ` You don't have any
                      subscribers to ${selectedSingleTier.name}, yet!
                      `
                        : `You don't have any subscribers, yet!`}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isDemoData ? (
        <p className="text-muted-foreground text-center text-sm">
          Demonstration data. Get your first subscribers to unlock your
          statistics!
        </p>
      ) : null}
    </div>
  )
}

export default ClientPage
