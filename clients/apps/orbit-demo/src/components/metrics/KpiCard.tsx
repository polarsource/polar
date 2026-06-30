'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { DeltaChip } from '../DeltaChip'

export type KpiCardProps = {
  label: string
  value: string
  delta: {
    value: number
    direction: 'up' | 'down'
    tone?: 'semantic' | 'neutral'
  }
  spark: number[]
  accent?: 'primary' | 'positive' | 'negative'
}

const ACCENT_STROKE: Record<NonNullable<KpiCardProps['accent']>, string> = {
  primary: 'var(--chart-primary)',
  positive: 'var(--chart-positive)',
  negative: 'var(--chart-negative)',
}

export const KpiCard = ({
  label,
  value,
  delta,
  spark,
  accent = 'primary',
}: KpiCardProps) => {
  const data = spark.map((v, i) => ({ i, v }))
  const stroke = ACCENT_STROKE[accent]
  const gradientId = `kpi-grad-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <Box
      backgroundColor="background-card"
      padding="xl"
      display="flex"
      flexDirection="column"
      rowGap="l"
      minHeight={180}
      justifyContent="between"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        columnGap="m"
      >
        <Text variant="heading-xxs">{label}</Text>
        <DeltaChip
          value={Math.abs(delta.value)}
          direction={delta.direction}
          tone={delta.tone}
        />
      </Box>

      <Text variant="heading-s" color="default" wrap="nowrap">
        {value}
      </Text>

      <Box width="100%" height={48}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}
