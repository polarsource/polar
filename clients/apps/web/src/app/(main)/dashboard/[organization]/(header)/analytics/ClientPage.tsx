'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import ProductSelect from '@/components/Products/ProductSelect'
import { useMetrics } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import {
  Interval,
  MetricPeriod,
  MetricsLimits,
  Organization,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export default function ClientPage({
  organization,
  limits,
  startDate,
  endDate,
  interval,
  productId,
  focus,
}: {
  organization: Organization
  limits: MetricsLimits
  startDate: Date
  endDate: Date
  interval: Interval
  productId?: string[]
  focus: keyof Omit<MetricPeriod, 'timestamp'>
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
    organizationId: organization.id,
    ...(productId ? { productId } : {}),
  })

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const getSearchParams = (
    dateRange: { from: Date; to: Date },
    interval: Interval,
    focus: keyof Omit<MetricPeriod, 'timestamp'>,
    productId?: string[],
  ) => {
    const params = new URLSearchParams()
    params.append('start_date', toISODate(dateRange.from))
    params.append('end_date', toISODate(dateRange.to))
    params.append('interval', interval)
    params.append('focus', focus)

    if (productId) {
      productId.forEach((id) => params.append('product_id', id))
    }

    return params
  }

  const onIntervalChange = useCallback(
    (interval: Interval) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        productId,
      )
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, startDate, endDate, focus, productId],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const params = getSearchParams(dateRange, interval, focus, productId)
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, interval, focus, productId],
  )

  const onProductSelect = useCallback(
    (value: string[]) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        value,
      )
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, interval, startDate, endDate, focus],
  )

  const onFocusChange = useCallback(
    (focus: keyof Omit<MetricPeriod, 'timestamp'>) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        productId,
      )
      router.push(`/dashboard/${organization.slug}/analytics?${params}`)
    },
    [router, organization, startDate, endDate, interval, productId],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2 lg:flex-row">
          <div className="w-full lg:w-1/6">
            <IntervalPicker interval={interval} onChange={onIntervalChange} />
          </div>
          <div className="w-full lg:w-1/4">
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateChange}
              maxDaysRange={maxDaysRange}
              minDate={minDate}
              className="w-full"
            />
          </div>
          <div className="w-full lg:w-1/6">
            <ProductSelect
              organization={organization}
              value={productId || []}
              onChange={onProductSelect}
              className="w-[300px]"
            />
          </div>
        </div>
        {data && (
          <>
            <div>
              <MetricChartBox
                data={data.periods}
                interval={interval}
                metric={data.metrics[focus]}
                height={300}
                maxTicks={10}
                focused={true}
              />
            </div>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              {Object.values(data.metrics)
                .filter((metric) => metric.slug !== focus)
                .map((metric) => (
                  <div key={metric.slug}>
                    <MetricChartBox
                      key={metric.slug}
                      data={data.periods}
                      interval={interval}
                      metric={metric}
                      height={150}
                      maxTicks={5}
                      focused={false}
                      onFocus={() => onFocusChange(metric.slug)}
                    />
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </DashboardBody>
  )
}
