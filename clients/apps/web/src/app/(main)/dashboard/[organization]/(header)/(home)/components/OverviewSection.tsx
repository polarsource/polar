'use client'

import { MetricGroup } from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/MetricGroup'
import { useMetrics } from '@/hooks/queries'
import { CHART_RANGES, ChartRange, getChartRangeParams } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import React from 'react'

const OVERVIEW_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'monthly_recurring_revenue',
  'active_subscriptions',
  'orders',
  'checkouts_conversion',
]

interface OverviewSectionProps {
  organization: schemas['Organization']
}

export function OverviewSection({ organization }: OverviewSectionProps) {
  const [range, setRange] = React.useState<ChartRange>('30d')

  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams(range, organization.created_at),
    [range, organization.created_at],
  )

  const { data } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: OVERVIEW_METRICS,
  })

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-gray-900 dark:text-white">
          Overview
        </h2>
        <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-1 rounded-xl border border-gray-200 bg-white p-1">
          {(Object.entries(CHART_RANGES) as [ChartRange, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={
                  range === key
                    ? 'rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white'
                    : 'dark:text-polar-400 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>
      <MetricGroup
        data={data}
        metricKeys={OVERVIEW_METRICS}
        interval={interval}
      />
    </div>
  )
}
