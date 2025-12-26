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

  const config = useMemo(
    () =>
      series.reduce(
        (acc, s) => ({
          ...acc,
          [s.key]: {
            label: s.label,
            color: s.color,
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
      if (valueFormatter) {
        const formattedValue = valueFormatter(value, name)
        return (
          <div className="flex w-40 flex-row justify-between gap-x-8">
            <div className="flex flex-row items-center gap-x-2">
              <span
                className="h-2 w-2 rounded-full"
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
      }

      return (
        <div className="flex w-40 flex-row justify-between gap-x-8">
          <div className="flex flex-row items-center gap-x-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: item?.color,
              }}
            />
            <span className="capitalize">
              {name.toString().split('_').join(' ')}
            </span>
          </div>
          <span>{value}</span>
        </div>
      )
    },
    [valueFormatter],
  )

  const primarySeries = series[0]
  const gradientInfo = useMemo(() => {
    if (!primarySeries) return { type: 'positive' as const, zeroOffset: 1 }
    const values = data.map((i) => (i[primarySeries.key] as number) || 0)
    const dataMax = Math.max(...values)
    const dataMin = Math.min(...values)

    if (dataMax <= 0) {
      return { type: 'negative' as const, zeroOffset: 0 }
    }
    if (dataMin >= 0) {
      return { type: 'positive' as const, zeroOffset: 1 }
    }

    return {
      type: 'mixed' as const,
      zeroOffset: dataMax / (dataMax - dataMin),
    }
  }, [data, primarySeries])

  const chartContent = useMemo(() => {
    const commonProps = {
      accessibilityLayer: true,
      data: data,
      margin: {
        left: showYAxis ? 4 : 24,
        right: 24,
        top: 24,
        bottom: showLegend ? 12 : undefined,
      },
      onMouseMove: ((state) => {
        if (onDataIndexHover) {
          const index = state.activeTooltipIndex
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

    const grid =
      showGrid || !simple ? (
        <CartesianGrid
          horizontal={false}
          vertical={true}
          stroke={isDark ? '#222225' : '#ccc'}
          strokeDasharray="6 6"
        />
      ) : undefined

    const xAxis = (
      <XAxis
        dataKey={xAxisKey as string}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval="equidistantPreserveStart"
        ticks={ticks}
        tickFormatter={
          xAxisFormatter ? (value) => xAxisFormatter(value) : undefined
        }
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
            labelKey={primarySeries?.key}
            formatter={formatter}
          />
        )}
      />
    )

    const legend = showLegend ? (
      <ChartLegend
        content={
          <ChartLegendContent>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3">
              {series.map((s) => (
                <div
                  key={s.key}
                  className={`flex items-center gap-1.5 whitespace-nowrap transition-opacity ${series.length > 1 ? 'cursor-pointer' : ''}`}
                  style={{
                    opacity:
                      activeSeries === null || activeSeries === s.key ? 1 : 0.3,
                  }}
                  onClick={
                    series.length > 1
                      ? () => handleLegendClick(s.key)
                      : undefined
                  }
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </div>
              ))}
            </div>
          </ChartLegendContent>
        }
      />
    ) : undefined

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {series
            .slice()
            .reverse()
            .map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={`var(--color-${s.key})`}
                radius={1}
                maxBarSize={index === series.length - 1 ? 16 : 10}
                opacity={
                  activeSeries === null || activeSeries === s.key ? 1 : 0.3
                }
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
              type="linear"
              dot={false}
              strokeWidth={1.5}
              strokeOpacity={
                activeSeries === null || activeSeries === s.key ? 1 : 0.3
              }
            />
          ))}
        </LineChart>
      )
    }

    if (!primarySeries) return null

    const gradientStops = (() => {
      const color = `var(--color-${primarySeries.key})`
      if (gradientInfo.type === 'positive') {
        return (
          <>
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0.025} />
          </>
        )
      }
      if (gradientInfo.type === 'negative') {
        return (
          <>
            <stop offset="0%" stopColor={color} stopOpacity={0.025} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </>
        )
      }
      // Mixed: 0.5 at edges, 0.025 at zero line
      return (
        <>
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop
            offset={`${gradientInfo.zeroOffset * 100}%`}
            stopColor={color}
            stopOpacity={0.025}
          />
          <stop offset="100%" stopColor={color} stopOpacity={0.5} />
        </>
      )
    })()

    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id={`areaGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
            {gradientStops}
          </linearGradient>
        </defs>
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        {legend}
        <Area
          dataKey={primarySeries.key}
          stroke={`var(--color-${primarySeries.key})`}
          fill={`url(#areaGradient-${id})`}
          type="linear"
          strokeWidth={1.5}
        />
      </AreaChart>
    )
  }, [
    chartType,
    data,
    showGrid,
    simple,
    isDark,
    ticks,
    xAxisKey,
    xAxisFormatter,
    formatter,
    series,
    primarySeries,
    onDataIndexHover,
    showYAxis,
    showLegend,
    hasDecimalValues,
    gradientInfo,
    activeSeries,
    handleLegendClick,
    id,
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
