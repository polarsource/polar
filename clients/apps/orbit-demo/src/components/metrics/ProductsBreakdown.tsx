'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCompactMoney, METRICS } from '@/data/metrics'
import { ChartShell } from './ChartShell'
import { ChartTooltip } from './ChartTooltip'

const SLICE_COLORS = [
  'var(--chart-primary)',
  'var(--chart-quinary)',
  'var(--chart-secondary)',
  'var(--chart-tertiary)',
  'var(--chart-quaternary)',
]

export const ProductsBreakdown = () => {
  const products = METRICS.products
  const totalRevenue = products.reduce((s, p) => s + p.revenueCents, 0)

  return (
    <ChartShell
      title="Revenue by product"
      subtitle="Share of revenue across the catalogue"
      height={280}
    >
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: '220px 1fr' }}
        columnGap="2xl"
        rowGap="xl"
        alignItems="center"
        height="100%"
      >
        <Box width="100%" height="100%">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={
                  <ChartTooltip
                    kind="currency"
                    nameMap={{ revenueCents: 'Revenue' }}
                  />
                }
              />
              <Pie
                data={products.map((p, idx) => ({
                  name: p.name,
                  revenueCents: p.revenueCents,
                  fill: SLICE_COLORS[idx % SLICE_COLORS.length],
                }))}
                dataKey="revenueCents"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              />

            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Box
          display="flex"
          flexDirection="column"
          rowGap="m"
          minHeight={0}
          overflow="hidden"
        >
          {products.map((p, idx) => {
            const share = (p.revenueCents / totalRevenue) * 100
            return (
              <Box
                key={p.id}
                display="flex"
                alignItems="center"
                columnGap="m"
              >
                <Box
                  width={10}
                  height={10}
                  style={{
                    backgroundColor: SLICE_COLORS[idx % SLICE_COLORS.length],
                  }}
                />
                <Box flex={1} display="flex" flexDirection="column" rowGap="xs">
                  <Box
                    display="flex"
                    alignItems="baseline"
                    justifyContent="between"
                    columnGap="m"
                  >
                    <Text variant="default" color="default">
                      {p.name}
                    </Text>
                    <Text variant="default" color="muted">
                      {formatCompactMoney(p.revenueCents)}
                    </Text>
                  </Box>
                  <Box
                    width="100%"
                    height={4}
                    backgroundColor="background-primary"
                    overflow="hidden"
                  >
                    <Box
                      height={4}
                      width={`${share.toFixed(1)}%`}
                      style={{
                        backgroundColor:
                          SLICE_COLORS[idx % SLICE_COLORS.length],
                      }}
                    />
                  </Box>
                </Box>
                <Text variant="caption" color="muted">
                  {share.toFixed(0)}%
                </Text>
              </Box>
            )
          })}
        </Box>
      </Box>
    </ChartShell>
  )
}
