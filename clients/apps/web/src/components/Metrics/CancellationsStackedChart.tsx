'use client'

import { ParsedMetricsResponse } from '@/hooks/queries'
import { getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import {
  CANCELLATION_REASONS,
  REASON_COLORS,
  REASON_LABELS,
} from './cancellations/constants'

interface CancellationsStackedChartProps {
  data: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  height?: number
}

export default function CancellationsStackedChart({
  data,
  interval,
  height = 300,
}: CancellationsStackedChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const chartData = useMemo(() => {
    return data.periods.map((period) => ({
      timestamp: period.timestamp,
      too_expensive: period.canceled_subscriptions_too_expensive,
      missing_features: period.canceled_subscriptions_missing_features,
      switched_service: period.canceled_subscriptions_switched_service,
      unused: period.canceled_subscriptions_unused,
      customer_service: period.canceled_subscriptions_customer_service,
      low_quality: period.canceled_subscriptions_low_quality,
      too_complex: period.canceled_subscriptions_too_complex,
      other: period.canceled_subscriptions_other,
    }))
  }, [data.periods])

  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {}
    CANCELLATION_REASONS.forEach((reason) => {
      config[reason] = {
        label: REASON_LABELS[reason],
        color: REASON_COLORS[reason],
      }
    })
    return config
  }, [])

  const timestampFormatter = getTimestampFormatter(interval)

  const maxValue = useMemo(() => {
    return Math.max(
      ...chartData.map((period) =>
        CANCELLATION_REASONS.reduce(
          (sum, reason) => sum + (period[reason] ?? 0),
          0,
        ),
      ),
    )
  }, [chartData])

  return (
    <div className="">
      <div className="p-4">
        <h3 className="text-lg">Cancellations</h3>
      </div>

      <ChartContainer config={chartConfig} style={{ height, width: '100%' }}>
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 24,
            right: 24,
            top: 24,
            bottom: 24,
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke={isDark ? '#222225' : '#e5e7eb'}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="timestamp"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="equidistantPreserveStart"
            tickFormatter={timestampFormatter}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, maxValue || 'auto']}
          />
          <ChartTooltip
            content={(props) => (
              <StackedChartTooltip
                {...props}
                tickFormatter={timestampFormatter}
              />
            )}
          />
          <ChartLegend
            content={<ChartLegendContent className="justify-start" />}
          />
          {CANCELLATION_REASONS.map((reason) => (
            <Bar
              key={reason}
              dataKey={reason}
              stackId="cancellations"
              fill={`var(--color-${reason})`}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )
}

const StackedChartTooltip = ({
  ref,
  active,
  label,
  payload,
  tickFormatter,
}: TooltipContentProps<any, any> & {
  tickFormatter: (timestamp: Date) => string
  ref?: React.RefObject<HTMLDivElement>
}) => {
  const formattedLabel = useMemo(() => {
    if (label) {
      return tickFormatter(new Date(label))
    }
    return ''
  }, [label, tickFormatter])

  if (!active || !payload?.length) {
    return null
  }

  const total = payload.reduce((acc, item) => acc + item.value, 0)

  return (
    <div
      ref={ref}
      className="border-border/50 bg-background grid min-w-32 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{formattedLabel}</span>
        <span className="font-medium tabular-nums">{total}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {payload.map((item) => {
          return (
            <div
              key={item.dataKey}
              className="flex items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: item.color }}
                />
                {REASON_LABELS[item.name as keyof typeof REASON_LABELS]}
              </div>
              <span className="font-medium tabular-nums">
                {item.value.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

StackedChartTooltip.displayName = 'ChartTooltip'
