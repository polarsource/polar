'use client'

import {
  GenericChart,
  GenericChartSeries,
} from '@/components/Charts/GenericChart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { usd } from './format'

interface ScenarioChartProps<T extends Record<string, unknown>> {
  data: T[]
  keys: { key: keyof T & string; label: string }[]
  xAxisFormatter: (value: string) => string
  height?: number
}

export const ScenarioChart = <T extends Record<string, unknown>>({
  data,
  keys,
  xAxisFormatter,
  height = 280,
}: ScenarioChartProps<T>) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const series = useMemo<GenericChartSeries[]>(() => {
    const palette = [isDark ? '#4b4c56' : '#c4c6cf', '#2563eb', '#14b8a6']
    return keys.map(({ key, label }, index) => ({
      key,
      label,
      color: palette[index % palette.length],
    }))
  }, [keys, isDark])

  return (
    <GenericChart
      data={data}
      series={series}
      xAxisKey="timestamp"
      xAxisFormatter={xAxisFormatter}
      valueFormatter={(value) => usd(value)}
      height={height}
      showLegend
      chartType="line"
    />
  )
}
