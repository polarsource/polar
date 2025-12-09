'use client'

import Spinner from '@/components/Shared/Spinner'
import {
  Area,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

export interface CostsBandedChartProps {
  data: Array<{
    timestamp: Date
    average: number
    p10: number
    p90: number
    p99: number
  }>
  height?: number
  xAxisFormatter?: (value: Date) => string
  yAxisFormatter?: (value: number) => string
  labelFormatter?: (value: Date) => string
  loading?: boolean
}

type ChartDataPoint = {
  timestamp: Date
  average: number
  p10: number
  p90: number
  p99: number
  band: [number, number]
}

export const CostsBandedChart = ({
  data,
  height = 400,
  xAxisFormatter,
  yAxisFormatter,
  labelFormatter,
  loading = false,
}: CostsBandedChartProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const chartData = useMemo<ChartDataPoint[]>(
    () =>
      data.map((d) => ({
        ...d,
        band: [d.p10, d.p90] as [number, number],
      })),
    [data],
  )

  const config = useMemo(
    () => ({
      average: {
        label: 'Average',
        color: '#2563eb',
      },
      p99: {
        label: 'P99',
        color: '#ef4444',
      },
      band: {
        label: 'P10-P90',
        color: isDark ? '#374151' : '#e5e7eb',
      },
    }),
    [isDark],
  )

  const hasDecimalValues = useMemo(() => {
    return data.some(
      (item) =>
        item.average % 1 !== 0 ||
        item.p10 % 1 !== 0 ||
        item.p90 % 1 !== 0 ||
        item.p99 % 1 !== 0,
    )
  }, [data])

  return (
    <div className="dark:bg-polar-900 flex w-full flex-col gap-y-2 rounded-2xl bg-white px-4 pt-4">
      {loading ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center p-8"
        >
          <Spinner />
        </div>
      ) : (
        <ChartContainer style={{ height, width: '100%' }} config={config}>
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 4,
              right: 24,
              top: 24,
              bottom: 12,
            }}
          >
            <CartesianGrid
              horizontal={false}
              vertical={true}
              stroke={
                isDark ? 'var(--color-polar-700)' : 'var(--color-gray-200)'
              }
              strokeDasharray="6 6"
            />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="equidistantPreserveStart"
              tickFormatter={
                xAxisFormatter
                  ? (value) => xAxisFormatter(value as Date)
                  : undefined
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={hasDecimalValues}
              tickMargin={4}
              width={60}
              tickFormatter={yAxisFormatter}
            />
            <ChartTooltip
              cursor={true}
              content={(props) => {
                if (!props.active || !props.payload?.length) return null

                const payload = props.payload[0]?.payload as ChartDataPoint
                if (!payload) return null

                const formattedLabel = labelFormatter
                  ? labelFormatter(payload.timestamp)
                  : payload.timestamp.toLocaleDateString()

                const items = [
                  {
                    key: 'average',
                    label: 'Average',
                    value: payload.average,
                    color: '#2563eb',
                  },
                  {
                    key: 'p10',
                    label: 'P10',
                    value: payload.p10,
                    color: isDark ? '#6b7280' : '#9ca3af',
                  },
                  {
                    key: 'p90',
                    label: 'P90',
                    value: payload.p90,
                    color: isDark ? '#6b7280' : '#9ca3af',
                  },
                  {
                    key: 'p99',
                    label: 'P99',
                    value: payload.p99,
                    color: '#ef4444',
                  },
                ]

                return (
                  <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                    <div className="mb-1 font-medium">{formattedLabel}</div>
                    <div className="grid gap-1.5">
                      {items.map((item) => {
                        const formattedValue = yAxisFormatter
                          ? yAxisFormatter(item.value)
                          : String(item.value)

                        return (
                          <div
                            key={item.key}
                            className="flex items-center gap-2"
                          >
                            <div
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-muted-foreground">
                              {item.label}
                            </span>
                            <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                              {formattedValue}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            <ChartLegend
              content={
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: '#2563eb' }}
                    />
                    Average
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: isDark ? '#374151' : '#e5e7eb',
                      }}
                    />
                    P10-P90
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: '#ef4444' }}
                    />
                    P99
                  </div>
                </div>
              }
            />
            <Area
              type="linear"
              dataKey="band"
              stroke="none"
              fill={isDark ? '#374151' : '#e5e7eb'}
              connectNulls
              dot={false}
              activeDot={false}
            />
            <Line
              type="linear"
              dataKey="average"
              stroke="#2563eb"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
            <Line
              type="linear"
              dataKey="p99"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </div>
  )
}
