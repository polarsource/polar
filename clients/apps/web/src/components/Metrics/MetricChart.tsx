import { ParsedMetricPeriod } from '@/hooks/queries'
import { getFormattedMetricValue, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useCallback, useMemo } from 'react'
import type { ExternalMouseEvents } from 'recharts/types/chart/types'
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
  height: _height,
  width: _width,
  onDataIndexHover,
  simple = false,
  showYAxis = false,
  chartType = 'line',
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

  const hasDecimalValues = useMemo(() => {
    return mergedData.some(
      (item) =>
        (typeof item.current === 'number' && item.current % 1 !== 0) ||
        (typeof item.previous === 'number' && item.previous % 1 !== 0),
    )
  }, [mergedData])

  const formatter = useCallback(
    (value: number, name: string, item?: { color?: string }) => {
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

  const gradientOffset = useMemo(() => {
    const dataMax = Math.max(...mergedData.map((i) => i.current || 0))
    const dataMin = Math.min(...mergedData.map((i) => i.current || 0))

    if (dataMax <= 0) {
      return 0
    }
    if (dataMin >= 0) {
      return 1
    }

    return dataMax / (dataMax - dataMin)
  }, [mergedData])

  const chartContent = useMemo(() => {
    const commonProps = {
      accessibilityLayer: true,
      data: mergedData,
      margin: {
        left: showYAxis ? 4 : 24,
        right: 24,
        top: 24,
      },
      onMouseMove: ((state) => {
        if (onDataIndexHover) {
          const index = state.activeTooltipIndex

          // We accidentally get stringified numbers here, for some reason
          // Instead of investigating, let's just parse to numbers
          const parsedIndex =
            typeof index === 'number'
              ? index
              : typeof index === 'string'
                ? parseInt(index, 10)
                : null

          onDataIndexHover(Number.isNaN(parsedIndex) ? null : parsedIndex)
        }
      }) satisfies ExternalMouseEvents['onMouseMove'],
      onMouseLeave: (() => {
        if (onDataIndexHover) {
          onDataIndexHover(null)
        }
      }) satisfies ExternalMouseEvents['onMouseLeave'],
    }

    const grid = simple ? undefined : (
      <CartesianGrid
        horizontal={false}
        vertical={true}
        stroke={isDark ? '#222225' : '#ccc'}
        strokeDasharray="6 6"
      />
    )

    const xAxis = (
      <XAxis
        dataKey="timestamp"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval="equidistantPreserveStart"
        ticks={ticks}
        tickFormatter={timestampFormatter}
      />
    )

    const yAxis = showYAxis ? (
      <YAxis
        tickLine={false}
        axisLine={false}
        allowDecimals={hasDecimalValues}
        tickMargin={4}
        width="auto"
      />
    ) : undefined

    const tooltip = (
      <ChartTooltip<number, string>
        cursor={true}
        content={(props) => (
          <ChartTooltipContent
            {...props}
            className="text-black dark:text-white"
            indicator="dot"
            labelKey="metric"
            formatter={formatter}
          />
        )}
      />
    )

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {previousData && (
            <Bar
              dataKey="previous"
              fill="var(--color-previous)"
              radius={1}
              maxBarSize={10}
            />
          )}
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            radius={1}
            maxBarSize={16}
          />
        </BarChart>
      )
    }

    if (previousData) {
      // Use LineChart when comparing two periods to avoid area collision
      return (
        <LineChart {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Line
            dataKey="previous"
            stroke="var(--color-previous)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            dataKey="current"
            stroke="var(--color-current)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      )
    }

    // Use AreaChart with gradient when showing single period
    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-current)"
              stopOpacity={0.5}
            />
            <stop
              offset={`${gradientOffset * 100}%`}
              stopColor="var(--color-current)"
              stopOpacity={0.025}
            />
          </linearGradient>
        </defs>
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        <Area
          dataKey="current"
          stroke="var(--color-current)"
          fill="url(#areaGradient)"
          type="linear"
          strokeWidth={1.5}
        />
      </AreaChart>
    )
  }, [
    chartType,
    mergedData,
    simple,
    isDark,
    ticks,
    timestampFormatter,
    formatter,
    previousData,
    onDataIndexHover,
    showYAxis,
    hasDecimalValues,
    gradientOffset,
  ])

  return (
    <ChartContainer
      ref={ref}
      style={{ height: _height, width: _width || '100%' }}
      config={config}
    >
      {chartContent}
    </ChartContainer>
  )
}

MetricChart.displayName = 'MetricChart'

export default MetricChart
