import { ParsedMetricPeriod } from '@/hooks/queries'
import { getFormattedMetricValue, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricChartProps {
  ref?: React.RefObject<HTMLDivElement | null>
  data: ParsedMetricPeriod[]
  previousData?: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  metric: schemas['Metric']
  height?: number
  width?: number
  grid?: boolean
  onDataIndexHover?: (index: number | undefined) => void
  simple?: boolean
}

const MetricChart = ({
  ref,
  data,
  previousData,
  interval,
  metric,
  height: _height,
  width: _width,
  onDataIndexHover,
  simple = false,
}: MetricChartProps & {
  ref?: React.RefObject<HTMLDivElement>
}) => {
  const { resolvedTheme } = useTheme()

  const mergedData = useMemo(
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

  const isDark = resolvedTheme === 'dark'

  const timestampFormatter = useMemo(
    () => getTimestampFormatter(interval),
    [interval],
  )

  const config = useMemo(
    () => ({
      current: {
        label: 'Current Period',
        color: '#2563eb',
      },
      previous: {
        label: 'Previous Period',
        color: isDark ? '#383942' : '#ccc',
      },
      metric: {
        label: metric.display_name,
      },
    }),
    [isDark, metric.display_name],
  )

  const ticks = useMemo(
    () =>
      simple
        ? [
            mergedData[0]?.timestamp,
            mergedData[mergedData.length - 1]?.timestamp,
          ]
        : undefined,
    [simple, mergedData],
  )

  const formatter = useCallback(
    (value: number, name: string, item: { color: string }) => {
      const formattedValue = getFormattedMetricValue(metric, value as number)
      return (
        <div className="flex w-40 flex-row justify-between gap-x-8">
          <div className="flex flex-row items-center gap-x-2">
            <span
              className={twMerge('h-2 w-2 rounded-full')}
              style={{
                backgroundColor: item?.color,
              }}
            />
            <span className="capitalize">
              {name.toString().split('_').join(' ')}
            </span>
          </div>
          <span>{formattedValue}</span>
        </div>
      )
    },
    [metric],
  )

  return (
    <ChartContainer
      ref={ref}
      style={{ height: _height, width: _width || '100%' }}
      config={config}
    >
      <LineChart
        accessibilityLayer
        data={mergedData}
        margin={{
          left: 24,
          right: 24,
          top: 24,
        }}
        onMouseMove={(state) => {
          if (onDataIndexHover) {
            const index = state.activeTooltipIndex
            onDataIndexHover(typeof index === 'number' ? index : undefined)
          }
        }}
        onMouseLeave={() => {
          if (onDataIndexHover) {
            onDataIndexHover(undefined)
          }
        }}
      >
        {simple ? undefined : (
          <CartesianGrid
            horizontal={false}
            vertical={true}
            stroke={isDark ? '#222225' : '#ccc'}
            strokeDasharray="6 6"
          />
        )}
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="equidistantPreserveStart"
          ticks={ticks}
          tickFormatter={timestampFormatter}
        />
        <ChartTooltip
          cursor={true}
          content={
            <ChartTooltipContent
              className="text-black dark:text-white"
              indicator="dot"
              labelKey="metric"
              formatter={formatter}
            />
          }
        />
        {previousData && (
          <Line
            dataKey="previous"
            stroke="var(--color-previous)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
        )}
        <Line
          dataKey="current"
          stroke="var(--color-current)"
          type="linear"
          dot={false}
          strokeWidth={1.5}
        />
      </LineChart>
    </ChartContainer>
  )
}

MetricChart.displayName = 'MetricChart'

export default MetricChart
