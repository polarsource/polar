'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatCompactMoney,
  formatShortDate,
  METRICS,
  type DailyPoint,
} from '@/data/metrics'
import { ChartShell } from './ChartShell'
import { ChartTooltip } from './ChartTooltip'

const AXIS_PROPS = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

type RevenueChartProps = {
  data?: DailyPoint[]
}

export const RevenueChart = ({ data = METRICS.daily }: RevenueChartProps) => {
  const totals = METRICS.totals
  return (
    <ChartShell
      title="Revenue"
      subtitle="Gross revenue across all products"
      value={formatCompactMoney(totals.revenueCents)}
      delta={{
        value: totals.revenueDeltaPct,
        direction: totals.revenueDeltaPct >= 0 ? 'up' : 'down',
      }}
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-primary)"
                stopOpacity={0.22}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-primary)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            interval={4}
            {...AXIS_PROPS}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactMoney(v)}
            width={56}
            {...AXIS_PROPS}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                dateLabel
                kind="currency"
                nameMap={{ revenueCents: 'Revenue' }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="revenueCents"
            stroke="var(--chart-primary)"
            strokeWidth={1.75}
            fill="url(#rev-grad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
