'use client'

import { MetricGroup } from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/MetricGroup'
import { useMetrics } from '@/hooks/queries'
import { CHART_RANGES, ChartRange, getChartRangeParams } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import React from 'react'
import { twMerge } from 'tailwind-merge'

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-medium text-gray-900 dark:text-white">
          Overview
        </h2>
        <div className="dark:bg-polar-800 flex items-center gap-x-1 self-start rounded-xl bg-gray-50 p-1">
          {(Object.entries(CHART_RANGES) as [ChartRange, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={twMerge(
                  'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium',
                  range === key
                    ? 'dark:bg-polar-600 bg-white text-black shadow-lg dark:text-white'
                    : 'dark:text-polar-500 text-gray-500 hover:text-gray-900 dark:hover:text-white',
                )}
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
