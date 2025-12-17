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
  metric: schemas['Metric']
  height?: number
  width?: number
  grid?: boolean
  onDataIndexHover?: (index: number | null) => void
  simple?: boolean
  showYAxis?: boolean
  chartType?: 'line' | 'bar'
}

const MetricChart = ({
  ref,
  data,
  previousData,
  interval,
  metric,
  height,
  width,
  grid,
  onDataIndexHover,
  simple = false,
  showYAxis = false,
  chartType = 'line',
}: MetricChartProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const genericData = useMemo(
    () =>
      data.map((period, index) => ({
        timestamp: period.timestamp,
        current:
          period[metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>],
        ...(previousData && previousData[index]
          ? {
              previous:
                previousData[index][
                  metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>
                ],
            }
          : {}),
      })),
    [data, previousData, metric.slug],
  )

  const series = useMemo(
    () => [
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
        key: 'current',
        label: 'Current Period',
        color: '#2563eb',
      },
    ],
    [previousData, isDark],
  )

  const timestampFormatter = useMemo(
    () => getTimestampFormatter(interval),
    [interval],
  )

  const valueFormatter = useMemo(
    () => (value: number) => getFormattedMetricValue(metric, value),
    [metric],
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
    />
  )
}

MetricChart.displayName = 'MetricChart'

export default MetricChart
