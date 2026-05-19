'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
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

type ChurnChartProps = {
  data?: DailyPoint[]
}

export const ChurnChart = ({ data = METRICS.daily }: ChurnChartProps) => {
  const totals = METRICS.totals
  return (
    <ChartShell
      title="Churn & subscription flow"
      subtitle="New vs canceled subscriptions and daily churn rate"
      value={`${totals.churnPct.toFixed(2)}%`}
      delta={{
        value: totals.churnDeltaPct,
        direction: totals.churnDeltaPct >= 0 ? 'up' : 'down',
        tone: 'neutral',
      }}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
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
          <YAxis yAxisId="flow" width={32} {...AXIS_PROPS} />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={48}
            {...AXIS_PROPS}
          />
          <Tooltip
            cursor={{ fill: 'var(--chart-fill)' }}
            content={
              <ChartTooltip
                dateLabel
                kind={{
                  newSubs: 'number',
                  canceledSubs: 'number',
                  churnPct: 'percent',
                }}
                nameMap={{
                  newSubs: 'New',
                  canceledSubs: 'Canceled',
                  churnPct: 'Churn',
                }}
              />
            }
          />
          <Bar
            yAxisId="flow"
            dataKey="newSubs"
            fill="var(--chart-primary)"
            stackId="flow"
            isAnimationActive={false}
            maxBarSize={14}
          />
          <Bar
            yAxisId="flow"
            dataKey="canceledSubs"
            fill="var(--chart-tertiary)"
            stackId="flow"
            isAnimationActive={false}
            maxBarSize={14}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="churnPct"
            stroke="var(--chart-primary)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
