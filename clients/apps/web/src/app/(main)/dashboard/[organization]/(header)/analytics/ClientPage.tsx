'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import ProductSelect from '@/components/Products/ProductSelect'
import { ParsedMetricsResponse, useMetrics } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  organization,
  limits,
  startDate,
  endDate,
  interval,
  productId,
}: {
  organization: schemas['Organization']
  limits: schemas['MetricsLimits']
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
  productId?: string[]
}) {
  const router = useRouter()

  const minDate = useMemo(() => fromISODate(limits.min_date), [limits])
  const maxDaysRange = useMemo(
    () => limits.intervals[interval].max_days,
    [interval, limits],
  )

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    ...(productId ? { product_id: productId } : {}),
  })

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
      const params = getSearchParams(dateRange, interval, productId)
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

  const generalEvents: (keyof schemas['Metrics'])[] = [
    'revenue',
    'monthly_recurring_revenue',
    'committed_monthly_recurring_revenue',
    'orders',
    'average_order_value',
    'cumulative_revenue',
  ]
  const subscriptionEvents: (keyof schemas['Metrics'])[] = [
    'active_subscriptions',
    'new_subscriptions',
    'renewed_subscriptions',
    'new_subscriptions_revenue',
    'renewed_subscriptions_revenue',
  ]
  const oneTimeEvents: (keyof schemas['Metrics'])[] = [
    'one_time_products',
    'one_time_products_revenue',
  ]
  const checkoutEvents: (keyof schemas['Metrics'])[] = [
    'checkouts',
    'succeeded_checkouts',
    'checkouts_conversion',
  ]
  const netRevenueEvents: (keyof schemas['Metrics'])[] = [
    'net_revenue',
    'net_average_order_value',
    'net_cumulative_revenue',
    'new_subscriptions_net_revenue',
    'renewed_subscriptions_net_revenue',
    'one_time_products_net_revenue',
  ]

  return (
    <DashboardBody
      wide
      header={
        <div className="flex flex-col items-center gap-2 lg:flex-row">
          <div className="w-full lg:w-auto">
            <IntervalPicker interval={interval} onChange={onIntervalChange} />
          </div>
          <div className="w-full lg:w-auto">
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateChange}
              maxDaysRange={maxDaysRange}
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
      <div className="flex flex-col gap-12">
        {data && (
          <>
            <MetricGroup
              title="Orders"
              metricKeys={generalEvents}
              data={data}
              interval={interval}
            />
            <MetricGroup
              title="Subscriptions"
              metricKeys={subscriptionEvents}
              data={data}
              interval={interval}
            />
            <MetricGroup
              title="One-time Purchases"
              metricKeys={oneTimeEvents}
              data={data}
              interval={interval}
            />
            <MetricGroup
              title="Checkouts"
              metricKeys={checkoutEvents}
              data={data}
              interval={interval}
            />
            <MetricGroup
              title="Net Revenue"
              metricKeys={netRevenueEvents}
              data={data}
              interval={interval}
            />
          </>
        )}
      </div>
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
              className={twMerge(
                '!rounded-none bg-transparent dark:bg-transparent',
                index === 0 && 'lg:col-span-2',
                'dark:border-polar-700 border-b border-r border-gray-200',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
