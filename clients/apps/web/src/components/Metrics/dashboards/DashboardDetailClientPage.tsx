'use client'

import { useMetricDashboards, useMetrics } from '@/hooks/queries/metrics'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'
import { MetricGroup } from './MetricGroup'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

const parseAsISODate = createParser({
  parse: (value: string) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date: Date) => toISODate(date),
})

interface DashboardDetailClientPageProps {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
}

export default function DashboardDetailClientPage({
  organization,
  dashboard: initialDashboard,
}: DashboardDetailClientPageProps) {
  const defaultStartDate = useMemo(() => subMonths(new Date(), 1), [])
  const defaultEndDate = useMemo(() => new Date(), [])

  // Use live query data so edits in the header modal are reflected immediately
  const { data: dashboards } = useMetricDashboards(organization.id)
  const dashboard = useMemo(
    () =>
      dashboards?.find(
        (d: schemas['MetricDashboardSchema']) => d.id === initialDashboard.id,
      ) ?? initialDashboard,
    [dashboards, initialDashboard],
  )

  const [interval] = useQueryState(
    'interval',
    parseAsStringLiteral(TIME_INTERVALS).withDefault('day'),
  )
  const [startDate] = useQueryState(
    'start_date',
    parseAsISODate.withDefault(defaultStartDate),
  )
  const [endDate] = useQueryState(
    'end_date',
    parseAsISODate.withDefault(defaultEndDate),
  )
  const [productId] = useQueryState('product_id', parseAsArrayOf(parseAsString))

  const { data } = useMetrics(
    {
      startDate,
      endDate,
      interval,
      organization_id: organization.id,
      ...(productId && productId.length > 0 ? { product_id: productId } : {}),
      metrics: dashboard.metrics.length > 0 ? dashboard.metrics : undefined,
    },
    dashboard.metrics.length > 0,
  )

  if (dashboard.metrics.length === 0) {
    return (
      <div className="dark:border-polar-700 flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          No metrics in this dashboard
        </p>
        <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
          Edit this dashboard to add metrics.
        </p>
      </div>
    )
  }

  return (
    <div className="py-8">
      <MetricGroup
        metricKeys={
          dashboard.metrics as unknown as (keyof schemas['Metrics'])[]
        }
        data={data}
        interval={interval}
      />
    </div>
  )
}
