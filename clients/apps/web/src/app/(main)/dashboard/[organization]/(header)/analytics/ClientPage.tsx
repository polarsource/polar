'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import ProductSelect from '@/components/Products/ProductSelect'
import { ParsedMetricPeriod, useMetrics } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import { components } from '@polar-sh/client'
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
  organization: components['schemas']['Organization']
  limits: components['schemas']['MetricsLimits']
  startDate: Date
  endDate: Date
  interval: components['schemas']['TimeInterval']
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
    interval: components['schemas']['TimeInterval'],
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
    (interval: components['schemas']['TimeInterval']) => {
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

  const generalEvents: (keyof components['schemas']['Metrics'])[] = [
    'revenue',
    'monthly_recurring_revenue',
    'orders',
    'average_order_value',
    'cumulative_revenue',
  ]
  const subscriptionEvents: (keyof components['schemas']['Metrics'])[] = [
    'active_subscriptions',
    'new_subscriptions',
    'renewed_subscriptions',
    'new_subscriptions_revenue',
    'renewed_subscriptions_revenue',
  ]
  const oneTimeEvents: (keyof components['schemas']['Metrics'])[] = [
    'one_time_products',
    'one_time_products_revenue',
  ]

  return (
    <DashboardBody
      wide
      transparent
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
      <div className="flex flex-col gap-8">
        {data && (
          <>
            <MetricGroup
              title="Orders"
              metricKeys={generalEvents}
              metrics={data.metrics}
              periods={data.periods}
              interval={interval}
            />
            <MetricGroup
              title="Subscriptions"
              metricKeys={subscriptionEvents}
              metrics={data.metrics}
              periods={data.periods}
              interval={interval}
            />
            <MetricGroup
              title="One-time Purchases"
              metricKeys={oneTimeEvents}
              metrics={data.metrics}
              periods={data.periods}
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
  metricKeys: (keyof components['schemas']['Metrics'])[]
  metrics: components['schemas']['Metrics']
  periods: ParsedMetricPeriod[]
  interval: components['schemas']['TimeInterval']
}

const MetricGroup = ({
  title,
  metricKeys,
  metrics,
  periods,
  interval,
}: MetricGroupProps) => {
  return (
    <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-y-8 rounded-2xl border border-gray-200 bg-white p-8">
      <h3 className="text-xl">{title}</h3>
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {metricKeys.map((metricKey, index) => (
            <MetricChartBox
              key={metricKey}
              data={periods}
              interval={interval}
              metric={
                metrics[metricKey as keyof components['schemas']['Metrics']]
              }
              height={200}
              maxTicks={5}
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
