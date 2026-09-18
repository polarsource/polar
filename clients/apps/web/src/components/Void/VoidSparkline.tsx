'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useTheme } from 'next-themes'
import { memo, ReactNode, useMemo } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { formatReducerTotal } from './reducers'

interface Datum {
  index: number
  value: number | null
  label?: string
}

interface VoidSparklineProps {
  values: (number | null)[]
  labels?: string[]
  height?: number
}

const CURRENT = '#2563eb'

function SparklineTooltip({ active, payload }: TooltipContentProps): ReactNode {
  const datum = payload[0]?.payload as Datum | undefined
  if (!active || !datum) return null
  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      paddingHorizontal="m"
      paddingVertical="s"
      backgroundColor="background-primary"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {datum.label ? (
        <Text variant="caption" color="muted">
          {datum.label}
        </Text>
      ) : null}
      <Text variant="caption">{formatReducerTotal(datum.value)}</Text>
    </Box>
  )
}

export const VoidSparkline = memo(function VoidSparkline({
  values,
  labels,
  height = 36,
}: VoidSparklineProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const data = useMemo<Datum[]>(
    () =>
      values.map((value, index) => ({ index, value, label: labels?.[index] })),
    [values, labels],
  )

  return (
    <Box position="relative" height={height} width="100%">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 2, bottom: 4, left: 2 }}
        >
          <XAxis dataKey="index" hide padding="no-gap" />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            filterNull={false}
            cursor={{
              stroke: isDark ? '#27282A' : '#E5E7EB',
              strokeWidth: 1,
            }}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 10, outline: 'none' }}
            content={SparklineTooltip}
          />
          <Line
            dataKey="value"
            type="linear"
            stroke={CURRENT}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
})
