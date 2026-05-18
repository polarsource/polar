'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricGroupProps {
  data?: ParsedMetricsResponse
  metricKeys: (keyof schemas['Metrics'])[]
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
      <div className="flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 flex-col gap-8 lg:grid-cols-2 2xl:grid-cols-3">
          {metricKeys.map((metricKey, index) => (
            <MetricChartBox
              key={String(metricKey)}
              data={data}
              interval={interval}
              metric={metricKey}
              height={200}
              chartType="line"
              loading={loading}
              hoveredPeriodIndex={hoveredPeriodIndex}
              onHoverPeriodChange={(period) => {
                if (period !== null) {
                  activeHoverKey.current = String(metricKey)
                  setHoveredPeriodIndex(period)
                } else if (activeHoverKey.current === String(metricKey)) {
                  activeHoverKey.current = null
                  setHoveredPeriodIndex(null)
                }
              }}
              className={twMerge(
                'rounded-none! bg-transparent dark:bg-transparent',
                index === 0 && 'lg:col-span-2',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
