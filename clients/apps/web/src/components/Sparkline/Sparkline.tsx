import { useTheme } from 'next-themes'
import React, { useId } from 'react'

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
  width?: number
  height?: number
  className?: string
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  trendUpIsBad = false,
  width = 160,
  height = 40,
  className = '',
}) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gradientId = useId()

  if (values.length === 0) {
    return null
  }

  const color = getTrendColor(values, trendUpIsBad)

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const padding = 2
  const viewBoxWidth = width
  const viewBoxHeight = height
  const chartHeight = viewBoxHeight - padding * 2
  const chartWidth = viewBoxWidth - padding * 2

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1 || 1)) * chartWidth
    const y = padding + chartHeight - ((value - min) / range) * chartHeight
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${viewBoxHeight} L ${padding} ${viewBoxHeight} Z`

  const colorConfig = {
    [SparklineColor.Green]: {
      stroke: '#10b981',
      gradientStart: 'rgba(16, 185, 129, 0.3)',
      gradientEnd: 'rgba(16, 185, 129, 0)',
    },
    [SparklineColor.Red]: {
      stroke: '#ef4444',
      gradientStart: 'rgba(239, 68, 68, 0.3)',
      gradientEnd: 'rgba(239, 68, 68, 0)',
    },
    [SparklineColor.Yellow]: {
      stroke: '#eab308',
      gradientStart: 'rgba(245, 158, 11, 0.3)',
      gradientEnd: 'rgba(245, 158, 11, 0)',
    },
    [SparklineColor.Gray]: isDark
      ? {
          stroke: 'hsl(233, 5%, 46%)',
          gradientStart: 'hsla(233, 5%, 46%, 0.3)',
          gradientEnd: 'hsla(233, 5%, 46%, 0)',
        }
      : {
          stroke: '#6b7280',
          gradientStart: 'rgba(107, 114, 128, 0.3)',
          gradientEnd: 'rgba(107, 114, 128, 0)',
        },
  }

  const config = colorConfig[color]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={config.gradientStart} />
          <stop offset="100%" stopColor={config.gradientEnd} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradientId})`} />

      <path d={linePath} fill="none" stroke={config.stroke} strokeWidth="1.5" />
    </svg>
  )
}
