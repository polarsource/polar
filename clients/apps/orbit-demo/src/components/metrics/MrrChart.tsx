'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatCompactMoney,
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

type MrrChartProps = {
  data?: DailyPoint[]
}

export const MrrChart = ({ data = METRICS.daily }: MrrChartProps) => {
  const totals = METRICS.totals
  return (
    <ChartShell
      title="MRR & active subscribers"
      subtitle="Recurring revenue against active count"
      value={formatCompactMoney(totals.mrrCents)}
      delta={{
        value: totals.mrrDeltaPct,
        direction: totals.mrrDeltaPct >= 0 ? 'up' : 'down',
        tone: 'neutral',
      }}
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            yAxisId="mrr"
            tickFormatter={(v: number) => formatCompactMoney(v)}
            width={56}
            {...AXIS_PROPS}
          />
          <YAxis
            yAxisId="subs"
            orientation="right"
            tickFormatter={(v: number) => formatCompactNumber(v)}
            width={40}
            {...AXIS_PROPS}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                dateLabel
                kind={{ mrrCents: 'currency', activeSubs: 'number' }}
                nameMap={{ mrrCents: 'MRR', activeSubs: 'Active subs' }}
              />
            }
          />
          <Line
            yAxisId="mrr"
            type="monotone"
            dataKey="mrrCents"
            stroke="var(--chart-primary)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="subs"
            type="monotone"
            dataKey="activeSubs"
            stroke="var(--chart-secondary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
