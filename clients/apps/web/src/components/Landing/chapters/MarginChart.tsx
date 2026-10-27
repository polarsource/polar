'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { CHART_POINTS, dollars, type MarginPoint } from './useUsageStream'
import { useTweenedValues } from './useTweened'

const W = 600
const H = 260
const PAD = { top: 16, right: 12, bottom: 28, left: 12 }

const cumulative = (points: MarginPoint[]) => {
  let revenue = 0
  let cost = 0
  return points.map((p) => {
    revenue += p.revenue
    cost += p.cost
    return { revenue, cost }
  })
}

/** The series resampled to a fixed number of points across the full width, so the path keeps one shape to tween. */
const resample = (values: number[], n: number) => {
  if (values.length === 0) return Array.from({ length: n }, () => 0)
  if (values.length === 1) return Array.from({ length: n }, () => values[0])
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (values.length - 1)
    const lo = Math.floor(t)
    const hi = Math.min(values.length - 1, lo + 1)
    return values[lo] + (values[hi] - values[lo]) * (t - lo)
  })
}

const path = (
  values: number[],
  x: (i: number) => number,
  y: (v: number) => number,
) =>
  values
    .map(
      (v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`,
    )
    .join('')

export const MarginChart = ({ series }: { series: MarginPoint[] }) => {
  const running = useMemo(() => cumulative(series), [series])
  const targets = useMemo(() => {
    const revenue = resample(
      running.map((p) => p.revenue),
      CHART_POINTS,
    )
    const cost = resample(
      running.map((p) => p.cost),
      CHART_POINTS,
    )
    // The scale rides a little above the top, so the line never pins to the frame.
    const top = Math.max(0.01, ...revenue) * 1.08
    return [...revenue, ...cost, top]
  }, [running])
  const shown = useTweenedValues(targets)
  const revenueValues = shown.slice(0, CHART_POINTS)
  const costValues = shown.slice(CHART_POINTS, CHART_POINTS * 2)
  const top = shown[CHART_POINTS * 2]

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (innerW * i) / (CHART_POINTS - 1)
  const y = (v: number) => PAD.top + innerH - (innerH * v) / top
  const drawn = running.length > 1
  const revenue = path(revenueValues, x, y)
  const cost = path(costValues, x, y)
  const area = `${revenue}${[...costValues]
    .reverse()
    .map((v, i) => `L${x(CHART_POINTS - 1 - i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join('')}Z`
  const last = running.at(-1)
  const gridlines = [0.25, 0.5, 0.75]

  return (
    <Box width="100%" flex={1} minHeight={0} flexDirection="column" rowGap="m">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block min-h-0 w-full flex-1 overflow-visible"
        role="img"
        aria-label="Revenue and cost per event, with the margin between them"
      >
        <defs>
          <pattern
            id="margin-stripes"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              className="stroke-black/10 dark:stroke-white/10"
              strokeWidth={1.5}
            />
          </pattern>
        </defs>
        {gridlines.map((g) => (
          <line
            key={g}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * (1 - g)}
            y2={PAD.top + innerH * (1 - g)}
            className="dark:stroke-polar-800 stroke-gray-200"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          className="dark:stroke-polar-700 stroke-gray-300"
          strokeWidth={1}
        />
        <g
          className="transition-opacity duration-500"
          style={{ opacity: drawn ? 1 : 0 }}
        >
          <path d={area} fill="url(#margin-stripes)" />
          <path
            d={cost}
            fill="none"
            className="dark:stroke-polar-500 stroke-gray-400"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeLinejoin="round"
          />
          <path
            d={revenue}
            fill="none"
            className="stroke-black dark:stroke-white"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle
            cx={x(CHART_POINTS - 1)}
            cy={y(revenueValues[CHART_POINTS - 1])}
            r={4}
            className="fill-black dark:fill-white"
          />
          <circle
            cx={x(CHART_POINTS - 1)}
            cy={y(costValues[CHART_POINTS - 1])}
            r={3}
            className="dark:fill-polar-500 fill-gray-400"
          />
        </g>
      </svg>
      <Box alignItems="center" columnGap="l">
        <Box alignItems="center" columnGap="l">
          <Box alignItems="center" columnGap="s">
            <div className="h-0.5 w-4 rounded-full bg-black dark:bg-white" />
            <Text variant="caption" color="muted">
              Revenue {last ? dollars(last.revenue, 2) : ''}
            </Text>
          </Box>
          <Box alignItems="center" columnGap="s">
            <div className="dark:border-polar-500 w-4 border-t border-dashed border-gray-400" />
            <Text variant="caption" color="muted">
              Cost {last ? dollars(last.cost, 2) : ''}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
