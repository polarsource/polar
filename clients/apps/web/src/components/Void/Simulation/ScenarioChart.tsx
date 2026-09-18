'use client'

import {
  GenericChart,
  GenericChartSeries,
} from '@/components/Charts/GenericChart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { usd } from './format'

export type SeriesKey = 'baseline' | 'scenario' | 'expected'

export const SERIES_LABEL: Record<SeriesKey, string> = {
  baseline: 'Baseline',
  scenario: 'Scenario',
  expected: 'Risk-adjusted',
}

export const useSeriesColors = (): Record<
  SeriesKey | 'reference',
  string
> => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return useMemo(
    () => ({
      baseline: isDark ? '#4b4c56' : '#c4c6cf',
      scenario: '#2563eb',
      expected: '#14b8a6',
      /** Threshold and annotation lines that need to stay legible. */
      reference: isDark ? '#8b8d97' : '#6b7280',
    }),
    [isDark],
  )
}

interface ScenarioChartProps<T extends Record<string, unknown>> {
  data: T[]
  keys: SeriesKey[]
  xAxisFormatter: (value: string) => string
  height?: number
  simple?: boolean
  legend?: boolean
  /** Hides the x-axis labels, for sparklines that bleed to the edges. */
  bare?: boolean
}

export const ScenarioChart = <T extends Record<string, unknown>>({
  data,
  keys,
  xAxisFormatter,
  height = 280,
  simple = false,
  legend = false,
  bare = false,
}: ScenarioChartProps<T>) => {
  const colors = useSeriesColors()
  const series = useMemo<GenericChartSeries[]>(
    () =>
      keys.map((key) => ({
        key,
        label: SERIES_LABEL[key],
        color: colors[key],
      })),
    [keys, colors],
  )

  return (
    <GenericChart
      data={data}
      series={series}
      xAxisKey="timestamp"
      xAxisFormatter={xAxisFormatter}
      valueFormatter={(value) => usd(value)}
      height={height}
      showLegend={legend && !simple}
      simple={simple}
      ticks={bare ? [] : undefined}
      chartType="line"
    />
  )
}
