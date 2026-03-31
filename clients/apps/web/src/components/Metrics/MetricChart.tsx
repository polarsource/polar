import { ParsedMetricPeriod } from '@/hooks/queries'
import { getFormattedMetricValue, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import type { AxisTick } from 'recharts/types/util/types'
import { GenericChart } from '../Charts/GenericChart'

interface MetricChartProps {
  ref?: React.RefObject<HTMLDivElement | null>
  data: ParsedMetricPeriod[]
  previousData?: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  metrics: schemas['Metric'][]
  height?: number
  width?: number
  grid?: boolean
  onDataIndexHover?: (index: number | null) => void
  simple?: boolean
  showYAxis?: boolean
  chartType?: 'line' | 'bar'
  activeCursorIndex?: number | null
}

const MetricChart = ({
  ref,
  data,
  previousData,
  interval,
  metrics,
  height,
  width,
  grid,
  onDataIndexHover,
  simple = false,
  showYAxis = false,
  chartType = 'line',
  activeCursorIndex,
}: MetricChartProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const genericData = useMemo(
    () =>
      data.map((period, index) => {
        const point: Record<string, unknown> = {
          timestamp: period.timestamp.toISOString(),
        }
        for (const m of metrics) {
          point[m.slug] =
            period[m.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>]
        }
        if (metrics.length === 1 && previousData?.[index]) {
          point['previous'] =
            previousData[index][
              metrics[0].slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>
            ]
        }
        return point
      }),
    [data, previousData, metrics],
  )

  const series = useMemo(
    () =>
      metrics.length > 1
        ? metrics
            .map((m, i) => ({
              key: m.slug,
              label: m.display_name,
              color: i === 0 ? '#2563eb' : isDark ? '#383942' : '#ccc',
            }))
            .reverse()
        : [
            ...(previousData
              ? [
                  {
                    key: 'previous',
                    label: 'Previous Period',
                    color: isDark ? '#383942' : '#ccc',
                  },
                ]
              : []),
            {
              key: metrics[0].slug,
              label: 'Current Period',
              color: '#2563eb',
            },
          ],
    [metrics, previousData, isDark],
  )

  const timestampFormatter = useMemo(() => {
    const fmt = getTimestampFormatter(interval)
    return (value: string | Date) =>
      fmt(typeof value === 'string' ? new Date(value) : value)
  }, [interval])

  const valueFormatter = useMemo(
    () => (value: number) => getFormattedMetricValue(metrics[0], value),
    [metrics],
  )

  const ticks = useMemo((): AxisTick[] | undefined => {
    if (!simple) return undefined
    return [
      genericData[0]?.timestamp as AxisTick,
      genericData[genericData.length - 1]?.timestamp as AxisTick,
    ].filter((t): t is AxisTick => t !== undefined)
  }, [simple, genericData])

  return (
    <GenericChart
      ref={ref}
      data={genericData}
      series={series}
      xAxisKey="timestamp"
      xAxisFormatter={timestampFormatter}
      valueFormatter={valueFormatter}
      height={height}
      width={width}
      showGrid={grid}
      showYAxis={showYAxis}
      chartType={chartType}
      onDataIndexHover={onDataIndexHover}
      simple={simple}
      ticks={ticks}
      activeCursorIndex={activeCursorIndex}
    />
  )
}

MetricChart.displayName = 'MetricChart'

export default MetricChart
