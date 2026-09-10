'use client'

import { formatHumanFriendlyScalar } from '@/utils/formatters'
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
import { subDays } from 'date-fns'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

const COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899']

const dayLabel = (timestamp: Date) =>
  timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const seriesKey = (name: string) => name.toLowerCase().replace(/\W+/g, '_')

export const VoidUsageChart = ({
  series,
  height = 260,
}: {
  /** Daily credits per meter name, oldest first. */
  series: Record<string, number[]>
  height?: number
}) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const names = Object.keys(series)
  const keys = names.map(seriesKey)

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        names.map((name, index) => [
          seriesKey(name),
          { label: name, color: COLORS[index % COLORS.length] },
        ]),
      ),
    [names],
  )

  const chartData = useMemo(() => {
    const days = series[names[0]]?.length ?? 0
    const end = new Date()
    return Array.from({ length: days }, (_, day) => ({
      timestamp: subDays(end, days - 1 - day),
      ...Object.fromEntries(
        names.map((name) => [seriesKey(name), series[name][day] ?? 0]),
      ),
    }))
  }, [series, names])

  return (
    <ChartContainer config={chartConfig} style={{ height, width: '100%' }}>
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 8, right: 8, top: 16, bottom: 8 }}
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
          tickFormatter={dayLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(value: number) => formatHumanFriendlyScalar(value)}
        />
        <ChartTooltip
          content={(props) => <UsageTooltip {...props} labels={chartConfig} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="usage"
            fill={`var(--color-${key})`}
            maxBarSize={28}
            radius={index === keys.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

const UsageTooltip = ({
  active,
  label,
  payload,
  labels,
}: TooltipContentProps & {
  labels: Record<string, { label: string; color: string }>
}) => {
  if (!active || !payload?.length) {
    return null
  }
  const total = payload.reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  )
  return (
    <div className="border-border/50 bg-background grid min-w-36 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">
          {label ? dayLabel(new Date(label)) : ''}
        </span>
        <span className="font-medium tabular-nums">
          {total.toLocaleString('en-US')} credits
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {payload.map((item) => (
          <div
            key={String(item.dataKey)}
            className="flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: item.color }}
              />
              {labels[String(item.dataKey)]?.label ?? String(item.name)}
            </div>
            <span className="font-medium tabular-nums">
              {Number(item.value).toLocaleString('en-US')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

UsageTooltip.displayName = 'ChartTooltip'
