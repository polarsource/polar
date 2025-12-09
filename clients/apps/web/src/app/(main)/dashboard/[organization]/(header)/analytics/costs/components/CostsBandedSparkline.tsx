'use client'

import {
  Area,
  ChartContainer,
  ComposedChart,
  Line,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

// Find the least squares slope to determine trend direction
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

enum TrendColor {
  Green = 'green',
  Red = 'red',
  Gray = 'gray',
}

const getTrendColor = (values: number[], trendUpIsBad: boolean): TrendColor => {
  if (values.length < 2) {
    return TrendColor.Gray
  }

  const slope = calculateTrendSlope(values)
  const range = Math.max(...values) - Math.min(...values)
  const normalizedSlope = range > 0 ? slope / range : 0
  const threshold = 0.01

  if (Math.abs(normalizedSlope) < threshold) {
    return TrendColor.Gray
  }

  const isTrendingUp = normalizedSlope > 0

  if (isTrendingUp) {
    return trendUpIsBad ? TrendColor.Red : TrendColor.Green
  } else {
    return trendUpIsBad ? TrendColor.Green : TrendColor.Red
  }
}

export interface CostsBandedSparklineProps {
  average: number[]
  p10: number[]
  p90: number[]
  p99: number[]
  trendUpIsBad?: boolean
  width?: number | string
  height?: number | string
  className?: string
}

type ChartDataPoint = {
  index: number
  average: number
  p10: number
  p90: number
  p99: number
  band: [number, number]
}

export const CostsBandedSparkline = ({
  average,
  p10,
  p90,
  p99,
  trendUpIsBad = true,
  width = '100%',
  height = 80,
  className = '',
}: CostsBandedSparklineProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const chartData = useMemo<ChartDataPoint[]>(() => {
    const length = Math.max(average.length, p10.length, p90.length, p99.length)
    return Array.from({ length }, (_, index) => ({
      index,
      average: average[index] ?? 0,
      p10: p10[index] ?? 0,
      p90: p90[index] ?? 0,
      p99: p99[index] ?? 0,
      band: [p10[index] ?? 0, p90[index] ?? 0] as [number, number],
    }))
  }, [average, p10, p90, p99])

  const trendColor = useMemo(
    () => getTrendColor(average, trendUpIsBad),
    [average, trendUpIsBad],
  )

  const colorConfig = useMemo(() => {
    const colors = {
      [TrendColor.Green]: {
        line: '#10b981',
        bandLight: isDark
          ? 'rgba(16, 185, 129, 0.15)'
          : 'rgba(16, 185, 129, 0.2)',
        bandDark: isDark
          ? 'rgba(16, 185, 129, 0.25)'
          : 'rgba(16, 185, 129, 0.35)',
      },
      [TrendColor.Red]: {
        line: '#ef4444',
        bandLight: isDark
          ? 'rgba(239, 68, 68, 0.15)'
          : 'rgba(239, 68, 68, 0.2)',
        bandDark: isDark
          ? 'rgba(239, 68, 68, 0.25)'
          : 'rgba(239, 68, 68, 0.35)',
      },
      [TrendColor.Gray]: {
        line: isDark ? 'hsl(233, 5%, 46%)' : '#6b7280',
        bandLight: isDark
          ? 'rgba(107, 114, 128, 0.15)'
          : 'rgba(107, 114, 128, 0.2)',
        bandDark: isDark
          ? 'rgba(107, 114, 128, 0.25)'
          : 'rgba(107, 114, 128, 0.35)',
      },
    }
    return colors[trendColor]
  }, [trendColor, isDark])

  const config = useMemo(
    () => ({
      average: {
        label: 'Average',
        color: colorConfig.line,
      },
      p99: {
        label: 'P99',
        color: colorConfig.line,
      },
      band: {
        label: 'P10-P90',
        color: colorConfig.bandDark,
      },
    }),
    [colorConfig],
  )

  const gradientId = `band-gradient-${trendColor}`

  if (chartData.length === 0) {
    return null
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
      <ComposedChart
        data={chartData}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={colorConfig.bandDark}
              stopOpacity={1}
            />
            <stop
              offset="100%"
              stopColor={colorConfig.bandLight}
              stopOpacity={1}
            />
          </linearGradient>
        </defs>
        <Area
          type="linear"
          dataKey="band"
          stroke="none"
          fill={`url(#${gradientId})`}
          connectNulls
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="average"
          stroke={colorConfig.line}
          strokeWidth={1.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="p99"
          stroke={colorConfig.line}
          strokeWidth={1}
          strokeDasharray="3 3"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
