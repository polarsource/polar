import React from 'react'

export enum SparklineColor {
  Green = 'green',
  Red = 'red',
}

interface SparklineProps {
  values: number[]
  color: SparklineColor
  width?: number
  height?: number
  className?: string
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  color,
  width = 160,
  height = 40,
  className = '',
}) => {
  if (values.length === 0) {
    return null
  }

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
  }

  const config = colorConfig[color]
  const gradientId = `sparkline-gradient-${color}-${Math.random().toString(36).substr(2, 9)}`

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

      <path
        d={linePath}
        fill="none"
        stroke={config.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
