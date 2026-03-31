'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { MetricEntry } from './metrics-config'

interface MetricGroupProps {
  data?: ParsedMetricsResponse
  metricKeys: MetricEntry[]
  interval: schemas['TimeInterval']
  loading?: boolean
}

export function MetricGroup({
  metricKeys,
  data,
  interval,
  loading,
}: MetricGroupProps) {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  // Track which chart owns the current hover so adjacent charts can't clear it
  const activeHoverKey = useRef<string | null>(null)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {metricKeys.map((entry, index) => {
            const keys = Array.isArray(entry) ? entry : [entry]
            const primaryKey = keys[0]
            return (
              <MetricChartBox
                key={String(primaryKey)}
                data={data}
                interval={interval}
                metric={primaryKey}
                metrics={keys.length > 1 ? keys : undefined}
                height={200}
                chartType="line"
                loading={loading}
                hoveredPeriodIndex={hoveredPeriodIndex}
                onHoverPeriodChange={(period) => {
                  if (period !== null) {
                    activeHoverKey.current = String(primaryKey)
                    setHoveredPeriodIndex(period)
                  } else if (activeHoverKey.current === String(primaryKey)) {
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
