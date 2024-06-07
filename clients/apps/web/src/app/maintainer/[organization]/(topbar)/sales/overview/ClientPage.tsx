'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { useMetrics } from '@/hooks/queries'
import { toISODate } from '@/utils/metrics'
import { Interval, MetricPeriod, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export default function ClientPage({
  organization,
  startDate,
  endDate,
  interval,
  focus,
}: {
  organization: Organization
  startDate: Date
  endDate: Date
  interval: Interval
  focus: keyof Omit<MetricPeriod, 'timestamp'>
}) {
  const router = useRouter()

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organizationId: organization.id,
  })

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const getSearchParams = (
    dateRange: { from: Date; to: Date },
    interval: Interval,
    focus: keyof Omit<MetricPeriod, 'timestamp'>,
  ) => {
    const params = new URLSearchParams()
    params.append('start_date', toISODate(dateRange.from))
    params.append('end_date', toISODate(dateRange.to))
    params.append('interval', interval)
    params.append('focus', focus)
    return params
  }

  const onIntervalChange = useCallback(
    (interval: Interval) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [router, organization, startDate, endDate, focus],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const params = getSearchParams(dateRange, interval, focus)
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [router, organization, interval, focus],
  )

  const onFocusChange = useCallback(
    (focus: keyof Omit<MetricPeriod, 'timestamp'>) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [router, organization, startDate, endDate, interval],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <div className="w-1/6">
            <IntervalPicker interval={interval} onChange={onIntervalChange} />
          </div>
          <DateRangePicker date={dateRange} onDateChange={onDateChange} />
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
