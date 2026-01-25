import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useCallback, useId, useMemo, useState } from 'react'
import type { ExternalMouseEvents } from 'recharts/types/chart/types'
import type { AxisTick } from 'recharts/types/util/types'

const MinHeightBar = (props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  radius?: number
  opacity?: number
}) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    fill,
    radius = 1,
    opacity = 1,
  } = props
  const minHeight = 4
  const actualHeight = height === 0 ? minHeight : height
  const actualY = height === 0 ? y - minHeight : y

  return (
    <rect
      x={x}
      y={actualY}
      width={width}
      height={actualHeight}
      fill={fill}
      rx={radius}
      ry={radius}
      opacity={opacity}
    />
  )
}

export interface GenericChartSeries {
  key: string
  label: string
  color: string
}

export interface GenericChartProps<T extends Record<string, unknown>> {
  ref?: React.RefObject<HTMLDivElement | null>
  data: T[]
  series: GenericChartSeries[]
  xAxisKey: keyof T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xAxisFormatter?: (value: any) => string
  valueFormatter?: (value: number, seriesKey: string) => React.ReactNode
  height?: number
  width?: number
  showGrid?: boolean
  showYAxis?: boolean
  showLegend?: boolean
  chartType?: 'line' | 'bar'
  onDataIndexHover?: (index: number | null) => void
  simple?: boolean
  ticks?: AxisTick[]
}

export const GenericChart = <T extends Record<string, unknown>>({
  ref,
  data,
  series,
  xAxisKey,
  xAxisFormatter,
  valueFormatter,
  height,
  width,
  showGrid = false,
  showYAxis = false,
  showLegend = false,
  chartType = 'line',
  onDataIndexHover,
  simple = false,
  ticks: customTicks,
}: GenericChartProps<T>) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const id = useId()

  const handleLegendClick = useCallback((key: string) => {
    setActiveSeries((currentValue) => (currentValue === key ? null : key))
  }, [])

  // 🔴 COLOR OVERRIDE IS HERE
  const config = useMemo(
    () =>
      series.reduce(
        (acc, s) => ({
          ...acc,
          [s.key]: {
            label: s.label,
            color: '#1e5a6a',
          },
        }),
        {} as Record<string, { label: string; color: string }>,
      ),
    [series],
  )

  const ticks = useMemo((): AxisTick[] | undefined => {
    if (customTicks) return customTicks
    if (simple && data.length > 0) {
      return [
        data[0]?.[xAxisKey] as AxisTick,
        data[data.length - 1]?.[xAxisKey] as AxisTick,
      ].filter((t): t is AxisTick => t !== undefined)
    }
    return undefined
  }, [simple, data, xAxisKey, customTicks])

  const hasDecimalValues = useMemo(() => {
    return data.some((item) =>
      series.some((s) => {
        const value = item[s.key]
        return typeof value === 'number' && value % 1 !== 0
      }),
    )
  }, [data, series])

  const formatter = useCallback(
    (
      value: number | undefined,
      name: string | undefined,
      item?: { color?: string },
    ) => {
      if (value === undefined || value === null || !name) {
        return null
      }

      const formatted = valueFormatter
        ? valueFormatter(value, name)
        : value

      return (
        <div className="flex w-40 justify-between gap-x-8">
          <div className="flex items-center gap-x-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item?.color }}
            />
            <span className="capitalize">
              {name.toString().split('_').join(' ')}
            </span>
          </div>
          <span>{formatted}</span>
        </div>
      )
    },
    [valueFormatter],
  )

  const primarySeries = series[0]

  const gradientInfo = useMemo(() => {
    if (!primarySeries) return { type: 'positive' as const, zeroOffset: 1 }
    const values = data.map((i) => (i[primarySeries.key] as number) || 0)
    const max = Math.max(...values)
    const min = Math.min(...values)

    if (max <= 0) return { type: 'negative' as const, zeroOffset: 0 }
    if (min >= 0) return { type: 'positive' as const, zeroOffset: 1 }

    return { type: 'mixed' as const, zeroOffset: max / (max - min) }
  }, [data, primarySeries])

  const chartContent = useMemo(() => {
    const commonProps = {
      accessibilityLayer: true,
      data,
      margin: {
        left: showYAxis ? 4 : 24,
        right: 24,
        top: 24,
        bottom: showLegend ? 12 : undefined,
      },
      onMouseMove: ((state) => {
        if (!onDataIndexHover) return
        const index =
          typeof state.activeTooltipIndex === 'number'
            ? state.activeTooltipIndex
            : null
        onDataIndexHover(index)
      }) satisfies ExternalMouseEvents['onMouseMove'],
      onMouseLeave: (() => {
        onDataIndexHover?.(null)
      }) satisfies ExternalMouseEvents['onMouseLeave'],
    }

    const grid =
      showGrid || !simple ? (
        <CartesianGrid
          horizontal={false}
          vertical
          stroke={isDark ? '#222225' : '#ccc'}
          strokeDasharray="6 6"
          syncWithTicks
        />
      ) : null

    const xAxis = (
      <XAxis
        dataKey={xAxisKey as string}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval="equidistantPreserveStart"
        ticks={ticks}
        tickFormatter={xAxisFormatter}
      />
    )

    const yAxis = showYAxis ? (
      <YAxis
        tickLine={false}
        axisLine={false}
        allowDecimals={hasDecimalValues}
        tickMargin={4}
      />
    ) : null

    const tooltip = (
      <ChartTooltip
        cursor
        content={(props) => (
          <ChartTooltipContent
            {...props}
            indicator="dot"
            labelKey={primarySeries?.key}
            formatter={formatter}
          />
        )}
      />
    )

    const legend = showLegend ? (
      <ChartLegend content={<ChartLegendContent />} />
    ) : null

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={4}
              shape={<MinHeightBar />}
            />
          ))}
        </BarChart>
      )
    }

    if (series.length > 1) {
      return (
        <LineChart {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      )
    }

    if (!primarySeries) return null

    return (
      <AreaChart {...commonProps}>
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        {legend}
        <Area
          dataKey={primarySeries.key}
          stroke={`var(--color-${primarySeries.key})`}
          fill={`var(--color-${primarySeries.key})`}
          strokeWidth={1.5}
        />
      </AreaChart>
    )
  }, [
    chartType,
    data,
    series,
    primarySeries,
    showGrid,
    showYAxis,
    showLegend,
    simple,
    ticks,
    xAxisKey,
    xAxisFormatter,
    formatter,
    hasDecimalValues,
    isDark,
    onDataIndexHover,
  ])

  return (
    <ChartContainer
      ref={ref}
      style={{ height, width: width || '100%' }}
      config={config}
    >
      {chartContent}
    </ChartContainer>
  )
}

GenericChart.displayName = 'GenericChart'

export default GenericChart

