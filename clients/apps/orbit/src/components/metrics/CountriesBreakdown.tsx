'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactMoney, METRICS } from '@/data/metrics'
import { ChartShell } from './ChartShell'
import { ChartTooltip } from './ChartTooltip'

const AXIS_PROPS = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const CountriesBreakdown = () => {
  const countries = METRICS.countries
  const data = countries.map((c) => ({
    name: c.name,
    code: c.code,
    revenueCents: c.revenueCents,
    customers: c.customers,
  }))

  return (
    <ChartShell
      title="Revenue by country"
      subtitle="Top markets in the last 30 days"
      height={280}
    >
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: '1fr 220px' }}
        columnGap="2xl"
        rowGap="xl"
        height="100%"
      >
        <Box width="100%" height="100%">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatCompactMoney(v)}
                {...AXIS_PROPS}
              />
              <YAxis
                type="category"
                dataKey="code"
                width={36}
                {...AXIS_PROPS}
              />
              <Tooltip
                cursor={{ fill: 'var(--chart-fill)' }}
                content={
                  <ChartTooltip
                    kind="currency"
                    nameMap={{ revenueCents: 'Revenue' }}
                  />
                }
              />
              <Bar
                dataKey="revenueCents"
                fill="var(--chart-primary)"
                isAnimationActive={false}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box display="flex" flexDirection="column" rowGap="m">
          {countries.map((c) => (
            <Box
              key={c.code}
              display="flex"
              alignItems="baseline"
              justifyContent="between"
              columnGap="m"
            >
              <Box display="flex" flexDirection="column" rowGap="xs">
                <Text variant="default" color="default">
                  {c.name}
                </Text>
                <Text variant="caption" color="muted">
                  {c.customers} customers
                </Text>
              </Box>
              <Text variant="default" color="default" wrap="nowrap">
                {formatCompactMoney(c.revenueCents)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </ChartShell>
  )
}
