'use client'

import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { useMemo, useState } from 'react'
import {
  CANCELLATION_REASONS,
  CancellationReason,
  REASON_COLORS,
  REASON_LABELS,
} from './cancellations/constants'

interface CancellationsDistributionChartProps {
  data: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  height?: number
}

interface ReasonData {
  reason: CancellationReason
  total: number
  percentage: number
  color: string
  label: string
}

export default function CancellationsDistributionChart({
  data,
  height = 20,
}: CancellationsDistributionChartProps) {
  const { chartData, legendData } = useMemo(() => {
    const totals: Record<CancellationReason, number> = {} as Record<
      CancellationReason,
      number
    >

    CANCELLATION_REASONS.forEach((reason) => {
      totals[reason] = data.periods.reduce((sum, period) => {
        const key = `canceled_subscriptions_${reason}` as keyof typeof period
        return sum + ((period[key] as number) || 0)
      }, 0)
    })

    const nonZeroReasons = CANCELLATION_REASONS.filter(
      (reason) => totals[reason] > 0,
    )
    const grandTotal = nonZeroReasons.reduce(
      (sum, reason) => sum + totals[reason],
      0,
    )

    const chartData =
      grandTotal === 0
        ? []
        : nonZeroReasons.map(
            (reason): ReasonData => ({
              reason,
              total: totals[reason],
              percentage: (totals[reason] / grandTotal) * 100,
              color: REASON_COLORS[reason],
              label: REASON_LABELS[reason],
            }),
          )

    const legendData = CANCELLATION_REASONS.map(
      (reason): ReasonData => ({
        reason,
        total: totals[reason],
        percentage: grandTotal > 0 ? (totals[reason] / grandTotal) * 100 : 0,
        color: REASON_COLORS[reason],
        label: REASON_LABELS[reason],
      }),
    )

    return { chartData, legendData }
  }, [data.periods])

  const [displayMode, setDisplayMode] = useState<'count' | 'percentage'>(
    'count',
  )

  return (
    <div className="relative">
      <div className="p-4">
        <h3 className="text-lg">Breakdown</h3>
      </div>

      <div className="relative px-4 pb-4">
        <div
          className="dark:bg-polar-600 flex w-full overflow-hidden rounded-xs bg-gray-100"
          style={{ height }}
        >
          {chartData.map((item) => (
            <div
              key={item.reason}
              className="relative transition-opacity"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-y-2 text-sm">
          {legendData.map((item) => (
            <div
              key={item.reason}
              className="flex items-center justify-start gap-2"
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-normal">{item.label}</span>
              <span
                className="dark:text-polar-400 -m-1 ml-auto p-1 text-right font-medium text-gray-500 tabular-nums"
                onClick={() =>
                  setDisplayMode((previousValue) =>
                    previousValue === 'count' ? 'percentage' : 'count',
                  )
                }
              >
                {displayMode === 'count'
                  ? item.total
                  : `${item.percentage.toFixed(2).replace('.00', '')}%`}
              </span>
            </div>
          ))}
          <div className="dark:border-polar-600 mt-1 flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
            <span className="dark:text-polar-400 font-medium text-gray-500">
              Total
            </span>
            <span className="ml-auto text-right font-medium tabular-nums">
              {legendData.reduce((sum, item) => sum + item.total, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
