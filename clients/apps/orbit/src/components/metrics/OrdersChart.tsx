'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatCompactNumber,
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

type OrdersChartProps = {
  data?: DailyPoint[]
}

export const OrdersChart = ({ data = METRICS.daily }: OrdersChartProps) => {
  const totals = METRICS.totals
  return (
    <ChartShell
      title="Orders"
      subtitle="Daily order volume"
      value={formatCompactNumber(totals.ordersCount)}
      delta={{
        value: totals.ordersDeltaPct,
        direction: totals.ordersDeltaPct >= 0 ? 'up' : 'down',
      }}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            tickFormatter={(v: number) => formatCompactNumber(v)}
            width={40}
            {...AXIS_PROPS}
          />
          <Tooltip
            cursor={{ fill: 'var(--chart-fill)' }}
            content={
              <ChartTooltip
                dateLabel
                kind="number"
                nameMap={{ ordersCount: 'Orders' }}
              />
            }
          />
          <Bar
            dataKey="ordersCount"
            fill="var(--chart-primary)"
            isAnimationActive={false}
            maxBarSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
