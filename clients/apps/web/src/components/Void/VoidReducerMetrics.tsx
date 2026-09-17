'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { useRef, useState } from 'react'
import { VoidReducerMetric } from './identityLive'

const CHART_CLASS =
  'rounded-none! bg-transparent dark:bg-transparent dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none'

function toChartData(metric: VoidReducerMetric): ParsedMetricsResponse {
  return {
    metrics: {
      orders: {
        slug: 'orders',
        display_name: metric.slug,
        type: 'scalar',
      },
    },
    totals: { orders: metric.total ?? 0 },
    periods: metric.periods.map((period) => ({
      timestamp: new Date(period.timestamp),
      orders: period.value ?? 0,
    })) as ParsedMetricPeriod[],
  }
}

interface VoidReducerMetricsProps {
  metrics: VoidReducerMetric[]
}

export function VoidReducerMetrics({ metrics }: VoidReducerMetricsProps) {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  const activeHoverKey = useRef<string | null>(null)

  const onHoverPeriodChange = (id: string, period: number | null) => {
    if (period !== null) {
      activeHoverKey.current = id
      setHoveredPeriodIndex(period)
      return
    }
    if (activeHoverKey.current === id) {
      activeHoverKey.current = null
      setHoveredPeriodIndex(null)
    }
  }

  return (
    <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
      <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-2 2xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricChartBox
            key={metric.id}
            data={toChartData(metric)}
            interval="day"
            metric="orders"
            height={200}
            chartType="line"
            shareable={false}
            exportable={false}
            hoveredPeriodIndex={hoveredPeriodIndex}
            onHoverPeriodChange={(period) =>
              onHoverPeriodChange(metric.id, period)
            }
            className={CHART_CLASS}
          />
        ))}
      </div>
    </div>
  )
}
