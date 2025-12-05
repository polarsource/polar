'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import CancellationsDistributionChart from '@/components/Metrics/CancellationsDistributionChart'
import CancellationsStackedChart from '@/components/Metrics/CancellationsStackedChart'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import ProductSelect from '@/components/Products/ProductSelect'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import { ParsedMetricsResponse, useMetrics, useProducts } from '@/hooks/queries'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { subMonths } from 'date-fns/subMonths'
import {
  BadgeDollarSignIcon,
  CircleUserRound,
  MousePointerClickIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  organization,
  earliestDateISOString,
  startDateISOString,
  endDateISOString,
  interval,
  productId,
}: {
  organization: schemas['Organization']
  earliestDateISOString: string
  startDateISOString?: string
  endDateISOString?: string
  interval: schemas['TimeInterval']
  productId?: string[]
}) {
  const router = useRouter()

  const minDate = useMemo(
    () => fromISODate(earliestDateISOString),
    [earliestDateISOString],
  )

  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    ...(productId ? { product_id: productId } : {}),
  })

  const { data: allProducts, isLoading: isProductsLoading } = useProducts(
    organization.id,
    { limit: 100 },
  )

  const relevantProducts = useMemo(() => {
    if (!allProducts?.items) {
      return []
    }

    if (!productId || productId.length === 0) {
      return allProducts.items
    }
    return allProducts.items.filter((p) => productId.includes(p.id))
  }, [allProducts, productId])

  const hasRecurringProducts = useMemo(
    () => relevantProducts.some((p) => p.is_recurring),
    [relevantProducts],
  )

  const hasOneTimeProducts = useMemo(
    () => relevantProducts.some((p) => !p.is_recurring),
    [relevantProducts],
  )

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const getSearchParams = (
    dateRange: { from: Date; to: Date },
    interval: schemas['TimeInterval'],
    productId?: string[],
  ) => {
    const params = new URLSearchParams()
    params.append('start_date', toISODate(dateRange.from))
    params.append('end_date', toISODate(dateRange.to))
    params.append('interval', interval)

    if (productId) {
      productId.forEach((id) => params.append('product_id', id))
    }

    return params
  }

  const onIntervalChange = useCallback(
    (interval: schemas['TimeInterval']) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        productId,
      )
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, startDate, endDate, productId],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(
        interval,
        dateRange.from,
        dateRange.to,
      )
      const params = getSearchParams(dateRange, validInterval, productId)
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, interval, productId],
  )

  const onProductSelect = useCallback(
    (value: string[]) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        value,
      )
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, interval, startDate, endDate],
  )

  const orderEvents: (keyof schemas['Metrics'])[] = useMemo(
    () => [
      ...(hasOneTimeProducts && !hasRecurringProducts
        ? []
        : (['revenue', 'orders'] as const)),
      'average_order_value',
      'cumulative_revenue',
    ],
    [hasOneTimeProducts, hasRecurringProducts],
  )

  const subscriptionEvents: (keyof schemas['Metrics'])[] = [
    'monthly_recurring_revenue',
    'committed_monthly_recurring_revenue',
    'active_subscriptions',
    'new_subscriptions',
    'renewed_subscriptions',
    'average_revenue_per_user',
    'ltv',
    'new_subscriptions_revenue',
    'renewed_subscriptions_revenue',
  ]

  const oneTimeEvents: (keyof schemas['Metrics'])[] = [
    'one_time_products',
    'one_time_products_revenue',
  ]

  const checkoutEvents: (keyof schemas['Metrics'])[] = [
    'checkouts_conversion',
    'checkouts',
    'succeeded_checkouts',
  ]

  const cancellationEvents: (keyof schemas['Metrics'])[] = [
    'canceled_subscriptions',
    'churned_subscriptions',
    'churn_rate',
  ]

  const costEvents: (keyof schemas['Metrics'])[] = [
    'costs', // COGS
    'cost_per_user', // Cost To Serve
    'gross_margin', // MRR - COGS
    'gross_margin_percentage', // Gross margin / MRR
    'cashflow',
  ]

  const netRevenueEvents = useMemo(() => {
    const baseEvents: (keyof schemas['Metrics'])[] = [
      'net_revenue',
      'net_average_order_value',
      'net_cumulative_revenue',
    ]
    const subscriptionNetEvents: (keyof schemas['Metrics'])[] = [
      'new_subscriptions_net_revenue',
      'renewed_subscriptions_net_revenue',
    ]
    const oneTimeNetEvents: (keyof schemas['Metrics'])[] = [
      'one_time_products_net_revenue',
    ]

    return [
      ...baseEvents,
      ...(hasRecurringProducts ? subscriptionNetEvents : []),
      ...(hasOneTimeProducts ? oneTimeNetEvents : []),
    ]
  }, [hasRecurringProducts, hasOneTimeProducts])

  // State for active tab - will be set to first available tab
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Fetch costs data for the Costs tab
  const { data: costData, isLoading: isCostsLoading } = useEventHierarchyStats(
    organization.id,
    {
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      interval,
      aggregate_fields: ['_cost.amount'],
      sorting: ['-total'],
    },
    organization.feature_settings?.revops_enabled ?? false,
  )

  // Determine available tabs based on product types
  const availableTabs = useMemo(() => {
    const tabs: { value: string; label: string }[] = []
    if (hasRecurringProducts) {
      tabs.push({ value: 'subscriptions', label: 'Subscriptions' })
      tabs.push({ value: 'cancellations', label: 'Cancellations' })
    }
    if (hasOneTimeProducts) {
      tabs.push({ value: 'one-time', label: 'One-time' })
    }
    tabs.push({ value: 'orders', label: 'Orders' })
    tabs.push({ value: 'checkouts', label: 'Checkouts' })
    tabs.push({ value: 'net-revenue', label: 'Net Revenue' })
    if (organization.feature_settings?.revops_enabled) {
      tabs.push({ value: 'costs', label: 'Costs' })
    }
    return tabs
  }, [
    hasRecurringProducts,
    hasOneTimeProducts,
    organization.feature_settings?.revops_enabled,
  ])

  // Set active tab to first available tab when tabs are determined
  // Only compute once products are loaded to avoid flash of wrong tab
  const effectiveActiveTab = useMemo(() => {
    if (activeTab) return activeTab
    if (isProductsLoading) return null
    return availableTabs[0]?.value ?? 'orders'
  }, [activeTab, isProductsLoading, availableTabs])

  return (
    <DashboardBody
      wide
      header={
        <div className="flex flex-col items-center gap-2 lg:flex-row">
          <div className="w-full lg:w-auto">
            <IntervalPicker
              interval={interval}
              onChange={onIntervalChange}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
          <div className="w-full lg:w-auto">
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateChange}
              minDate={minDate}
              className="w-full"
            />
          </div>
          <div className="w-full lg:w-auto">
            <ProductSelect
              organization={organization}
              value={productId || []}
              onChange={onProductSelect}
              className="w-auto"
            />
          </div>
        </div>
      }
    >
      <Tabs
        value={effectiveActiveTab ?? ''}
        onValueChange={setActiveTab}
        className="flex flex-col"
      >
        <TabsList className="mb-8 flex-wrap">
          {availableTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {data && (
          <>
            {/* Subscriptions Tab */}
            {hasRecurringProducts && (
              <TabsContent
                value="subscriptions"
                className="flex flex-col gap-12"
              >
                <MetricGroup
                  title="Subscriptions"
                  metricKeys={subscriptionEvents}
                  data={data}
                  interval={interval}
                />
              </TabsContent>
            )}

            {/* Cancellations Tab */}
            {hasRecurringProducts && (
              <TabsContent
                value="cancellations"
                className="flex flex-col gap-12"
              >
                <div className="flex flex-col gap-y-6">
                  <h3 className="text-2xl">Cancellations</h3>
                  <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
                    <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
                      <div className="dark:border-polar-700 col-span-2 border-t-0 border-r border-b border-l-0 border-gray-200 p-4">
                        <CancellationsStackedChart
                          data={data}
                          interval={interval}
                          height={400}
                        />
                      </div>
                      <div className="dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 p-4">
                        <CancellationsDistributionChart
                          data={data}
                          interval={interval}
                          height={20}
                        />
                      </div>
                      {cancellationEvents.map((metricKey) => (
                        <MetricChartBox
                          key={metricKey}
                          data={data}
                          interval={interval}
                          metric={metricKey}
                          height={200}
                          chartType="line"
                          className="dark:border-polar-700 rounded-none! border-t-0 border-r border-b border-l-0 border-gray-200 bg-transparent shadow-none dark:bg-transparent"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* One-time Purchases Tab */}
            {hasOneTimeProducts && (
              <TabsContent value="one-time" className="flex flex-col gap-12">
                <MetricGroup
                  title="One-time Purchases"
                  metricKeys={oneTimeEvents}
                  data={data}
                  interval={interval}
                />
              </TabsContent>
            )}

            {/* Orders Tab */}
            <TabsContent value="orders" className="flex flex-col gap-12">
              <MetricGroup
                title="Orders"
                metricKeys={orderEvents}
                data={data}
                interval={interval}
              />
            </TabsContent>

            {/* Checkouts Tab */}
            <TabsContent value="checkouts" className="flex flex-col gap-12">
              <MetricGroup
                title="Checkouts"
                metricKeys={checkoutEvents}
                data={data}
                interval={interval}
              />
            </TabsContent>

            {/* Net Revenue Tab */}
            <TabsContent value="net-revenue" className="flex flex-col gap-12">
              <MetricGroup
                title="Net Revenue"
                metricKeys={netRevenueEvents}
                data={data}
                interval={interval}
              />
            </TabsContent>

            {/* Costs Tab */}
            {organization.feature_settings?.revops_enabled && (
              <TabsContent value="costs" className="flex flex-col gap-y-6">
                <MetricGroup
                  title="Cost Metrics"
                  metricKeys={costEvents}
                  data={data}
                  interval={interval}
                />
                <div className="flex flex-col gap-y-4">
                  <h3 className="text-2xl">Event Costs</h3>
                  {!isCostsLoading && costData?.totals.length === 0 && (
                    <p className="dark:text-polar-400 dark:bg-polar-800 flex items-center justify-center rounded-2xl bg-gray-50 p-12 text-center text-sm text-gray-500">
                      No cost data available for the selected date range
                    </p>
                  )}
                  {(costData?.totals ?? []).map((totals) => (
                    <EventStatisticsCard
                      key={totals.name}
                      periods={costData?.periods || []}
                      eventStatistics={totals}
                      organization={organization}
                      startDate={toISODate(startDate)}
                      endDate={toISODate(endDate)}
                      interval={interval}
                    />
                  ))}
                </div>
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </DashboardBody>
  )
}

interface MetricGroupProps {
  title: string
  data: ParsedMetricsResponse
  metricKeys: (keyof schemas['Metrics'])[]
  interval: schemas['TimeInterval']
}

const MetricGroup = ({
  title,
  metricKeys,
  data,
  interval,
}: MetricGroupProps) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-2xl">{title}</h3>
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {metricKeys.map((metricKey, index) => (
            <MetricChartBox
              key={metricKey}
              data={data}
              interval={interval}
              metric={metricKey}
              height={200}
              chartType="line"
              className={twMerge(
                'rounded-none! bg-transparent dark:bg-transparent',
                index === 0 && 'lg:col-span-2',
                'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Helper function to get time series values for cost sparklines
type TimeSeriesField = 'average' | 'p95' | 'p99'

const getTimeSeriesValues = (
  periods: schemas['StatisticsPeriod'][],
  eventName: schemas['EventStatistics']['name'],
  field: TimeSeriesField,
): number[] => {
  return periods.map((period) => {
    const eventStats = period.stats.find((stat) => stat.name === eventName)
    if (!eventStats) return 0

    if (field === 'average') {
      return parseFloat(eventStats.averages?.['_cost_amount'] || '0')
    } else if (field === 'p95') {
      return parseFloat(eventStats.p95?.['_cost_amount'] || '0')
    } else if (field === 'p99') {
      return parseFloat(eventStats.p99?.['_cost_amount'] || '0')
    }
    return 0
  })
}

// Helper function to generate search params for costs links
const getCostsSearchParams = (
  startDate: string,
  endDate: string,
  interval: string,
): string => {
  const params = new URLSearchParams()
  params.set('startDate', startDate)
  params.set('endDate', endDate)
  params.set('interval', interval)
  return params.toString()
}

// Event Statistics Card component for the Costs tab
interface EventStatisticsCardProps {
  periods: schemas['StatisticsPeriod'][]
  eventStatistics: schemas['EventStatistics']
  organization: schemas['Organization']
  startDate: string
  endDate: string
  interval: string
}

const EventStatisticsCard = ({
  periods,
  eventStatistics,
  organization,
  startDate,
  endDate,
  interval,
}: EventStatisticsCardProps) => {
  const averageCostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'average')
  }, [periods, eventStatistics.name])

  const p95CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p95')
  }, [periods, eventStatistics.name])

  const p99CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p99')
  }, [periods, eventStatistics.name])

  const searchString = getCostsSearchParams(startDate, endDate, interval)

  return (
    <Link
      href={`/dashboard/${organization.slug}/analytics/costs/${eventStatistics.event_type_id}${searchString ? `?${searchString}` : ''}`}
      className="dark:bg-polar-700 dark:hover:border-polar-600 dark:border-polar-700 @container flex cursor-pointer flex-col gap-4 rounded-2xl border border-gray-100 p-4 transition-colors hover:border-gray-200"
    >
      <div className="flex flex-col justify-between gap-3 @xl:flex-row">
        <h2 className="text-lg font-medium">
          {eventStatistics.label ?? eventStatistics.name}
        </h2>
        <dl className="dark:text-polar-500 flex max-w-sm flex-1 items-center gap-5 font-mono text-gray-500">
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            <dt>
              <MousePointerClickIcon className="size-5" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.occurrences}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            <dt>
              <CircleUserRound className="size-5" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.customers}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            {eventStatistics.totals?._cost_amount !== undefined && (
              <>
                <dt>
                  <BadgeDollarSignIcon className="size-5" strokeWidth={1.5} />
                </dt>
                <dd>
                  {formatSubCentCurrency(
                    Number(eventStatistics.totals?._cost_amount),
                    'usd',
                  )}
                </dd>
              </>
            )}
          </div>
        </dl>
      </div>
      <div className="flex flex-col gap-5 @3xl:flex-row">
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>Average cost</h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.averages?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={averageCostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>
              95<sup>th</sup> percentile{' '}
              <span className="hidden sm:inline @3xl:hidden @5xl:inline">
                cost
              </span>
            </h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.p95?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={p95CostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>
              99<sup>th</sup> percentile{' '}
              <span className="hidden sm:inline @3xl:hidden @5xl:inline">
                cost
              </span>
            </h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.p99?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={p99CostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
