'use client'

import {
  Area,
  AreaChart,
  ChartContainer,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'

// Find the least squares slope to determine trend direction
// We can't just use first and last values because of noise in the data (and each day/period resetting the counter at 0)
const calculateTrendSlope = (values: number[]): number => {
  if (values.length < 2) {
    return 0
  }

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) {
    return 0
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  return slope
}

const getTrendColor = (
  values: number[],
  trendUpIsBad: boolean,
): SparklineColor => {
  if (values.length < 2) {
    return SparklineColor.Gray
  }

  const slope = calculateTrendSlope(values)
  const range = Math.max(...values) - Math.min(...values)
  const normalizedSlope = range > 0 ? slope / range : 0
  const threshold = 0.01

  if (Math.abs(normalizedSlope) < threshold) {
    return SparklineColor.Gray
  }

  const isTrendingUp = normalizedSlope > 0

  if (isTrendingUp) {
    return trendUpIsBad ? SparklineColor.Red : SparklineColor.Green
  } else {
    return trendUpIsBad ? SparklineColor.Green : SparklineColor.Red
  }
}

export enum SparklineColor {
  Green = 'green',
  Yellow = 'yellow',
  Red = 'red',
  Gray = 'gray',
}

interface SparklineProps {
  values: number[]
  trendUpIsBad?: boolean
  width?: number | string
  height?: number | string
  className?: string
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  trendUpIsBad = false,
  width = '100%',
  height = 40,
  className = '',
}) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const data = useMemo(
    () => values.map((value, index) => ({ index, value })),
    [values],
  )

  const color = useMemo(
    () => getTrendColor(values, trendUpIsBad),
    [values, trendUpIsBad],
  )

  if (values.length === 0) {
    return null
  }

  const colorConfig = {
    [SparklineColor.Green]: {
      stroke: '#10b981',
      fill: '#10b981',
    },
    [SparklineColor.Red]: {
      stroke: '#ef4444',
      fill: '#ef4444',
    },
    [SparklineColor.Yellow]: {
      stroke: '#eab308',
      fill: '#eab308',
    },
    [SparklineColor.Gray]: isDark
      ? {
          stroke: 'hsl(233, 5%, 46%)',
          fill: 'hsl(233, 5%, 46%)',
        }
      : {
          stroke: '#6b7280',
          fill: '#6b7280',
        },
  }

  const config = {
    value: {
      label: 'Value',
      color: colorConfig[color].stroke,
    },
  }

  return (
    <ChartContainer
      config={config}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={colorConfig[color].fill}
              stopOpacity={0.3}
            />
            <stop
              offset="100%"
              stopColor={colorConfig[color].fill}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={colorConfig[color].stroke}
          strokeWidth={1.5}
          fill={`url(#gradient-${color})`}
          fillOpacity={1}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
