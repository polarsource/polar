'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const METRIC_KEYS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'monthly_recurring_revenue',
  'active_subscriptions',
  'churn_rate',
]

interface VoidMetricGridProps {
  data: ParsedMetricsResponse
  previousData: ParsedMetricsResponse
}

export const VoidMetricGrid = ({ data, previousData }: VoidMetricGridProps) => {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  const activeHoverKey = useRef<string | null>(null)

  return (
    <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
      <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-2 2xl:grid-cols-3">
        {METRIC_KEYS.map((metricKey, index) => (
          <MetricChartBox
            key={metricKey}
            data={data}
            previousData={index === 0 ? previousData : undefined}
            interval="day"
            metric={metricKey}
            height={200}
            chartType="line"
            shareable={false}
            exportable={false}
            hoveredPeriodIndex={hoveredPeriodIndex}
            onHoverPeriodChange={(period) => {
              if (period !== null) {
                activeHoverKey.current = metricKey
                setHoveredPeriodIndex(period)
              } else if (activeHoverKey.current === metricKey) {
                activeHoverKey.current = null
                setHoveredPeriodIndex(null)
              }
            }}
            className={twMerge(
              'rounded-none! bg-transparent dark:bg-transparent',
              index === 0 && 'lg:col-span-2',
              'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
            )}
          />
        ))}
      </div>
    </div>
  )
}
