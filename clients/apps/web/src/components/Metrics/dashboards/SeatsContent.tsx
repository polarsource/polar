'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const CUSTOMER_METRICS: (keyof schemas['Metrics'])[] = [
  'seat_customers',
  'new_seat_customers',
  'churned_seat_customers',
]

const SEAT_METRICS: (keyof schemas['Metrics'])[] = [
  'seats_total',
  'average_seats_per_customer',
  'seat_utilization_rate',
]

interface SeatsContentProps {
  data: ParsedMetricsResponse
  interval: schemas['TimeInterval']
}

function MetricSection({
  title,
  metricKeys,
  data,
  interval,
}: {
  title: string
  metricKeys: (keyof schemas['Metrics'])[]
  data?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
}) {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  const activeHoverKey = useRef<string | null>(null)

  return (
    <div className="flex flex-col gap-y-3">
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {metricKeys.map((metricKey, index) => (
            <MetricChartBox
              key={String(metricKey)}
              data={data}
              interval={interval}
              metric={metricKey}
              height={200}
              chartType="line"
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
                'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SeatsContent({ data, interval }: SeatsContentProps) {
  return (
    <div className="flex flex-col gap-y-8">
      <MetricSection
        title="Customers"
        metricKeys={CUSTOMER_METRICS}
        data={data}
        interval={interval}
      />
      <MetricSection
        title="Seats"
        metricKeys={SEAT_METRICS}
        data={data}
        interval={interval}
      />
    </div>
  )
}
