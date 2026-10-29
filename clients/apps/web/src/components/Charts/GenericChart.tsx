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
  ReferenceLine,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from '@polar-sh/ui/components/ui/chart'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useTheme } from 'next-themes'
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
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

const MarkerDot = ({
  viewBox,
  fill,
  stroke,
  r = 3,
}: {
  viewBox?: { x?: number; y?: number }
  fill: string
  stroke?: string
  r?: number
}) => (
  <circle cx={viewBox?.x} cy={viewBox?.y} r={r} fill={fill} stroke={stroke} />
)

export interface ChartMarker {
  x: string | number
  items: { prefix?: string; label: string }[]
}

const MAX_TOOLTIP_MARKER_ITEMS = 3

const MarkerTooltipRows = ({ marker }: { marker: ChartMarker }) => {
  const hidden = marker.items.length - MAX_TOOLTIP_MARKER_ITEMS
  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      paddingTop="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {marker.items.slice(0, MAX_TOOLTIP_MARKER_ITEMS).map((item, index) => (
        <Box key={index} alignItems="baseline" columnGap="xs">
          {item.prefix && (
            <Text variant="caption" color="muted">
              {item.prefix}
            </Text>
          )}
          <Text variant="label" truncate>
            {item.label}
          </Text>
        </Box>
      ))}
      {hidden > 0 && (
        <Text variant="caption" color="muted">
          +{hidden} more
        </Text>
      )}
    </Box>
  )
}

export interface GenericChartSeries {
  key: string
  label: string
  color: string
}

interface GenericChartProps<T extends Record<string, unknown>> {
  ref?: React.RefObject<HTMLDivElement | null>
  data: T[]
  series: GenericChartSeries[]
  xAxisKey: keyof T
  // oxlint-disable-next-line typescript/no-explicit-any
  xAxisFormatter?: (value: any) => string
  // oxlint-disable-next-line typescript/no-explicit-any
  labelFormatter?: (value: any) => string
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
  activeCursorIndex?: number | null
  markers?: ChartMarker[]
}

export const GenericChart = <T extends Record<string, unknown>>({
  ref,
  data,
  series,
  xAxisKey,
  xAxisFormatter,
  labelFormatter,
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
  activeCursorIndex,
  markers,
}: GenericChartProps<T>) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const guideLineColor = isDark ? '#27272A' : '#E4E4E7'
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const id = useId()

  const handleLegendClick = useCallback((key: string) => {
    setActiveSeries((currentValue) => (currentValue === key ? null : key))
  }, [])

  // Use a ref so mouse handlers are stable and don't invalidate chartBase memo
  const onDataIndexHoverRef = useRef(onDataIndexHover)
  useEffect(() => {
    onDataIndexHoverRef.current = onDataIndexHover
  }, [onDataIndexHover])

  const handleMouseMove = useCallback((state: MouseHandlerDataParam) => {
    const index = state.activeTooltipIndex
    const parsedIndex =
      typeof index === 'number'
        ? index
        : typeof index === 'string'
          ? parseInt(index, 10)
          : null
    onDataIndexHoverRef.current?.(
      Number.isNaN(parsedIndex) ? null : parsedIndex,
    )
  }, [])

  const handleMouseLeave = useCallback(() => {
    onDataIndexHoverRef.current?.(null)
  }, [])

  const config = useMemo(
    () =>
      series.reduce(
        (acc, s) => {
          acc[s.key] = { label: s.label, color: s.color }
          return acc
        },
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

  // Tooltip title = the formatted value of the hovered X-axis point (e.g. the
  // date), read straight from the data row so it works whether the axis value
  // is a string or a Date. Falls back to the axis tick formatter.
  const tooltipLabelFormatter = useMemo(() => {
    const fmt = labelFormatter ?? xAxisFormatter
    if (!fmt) return undefined
    // oxlint-disable-next-line typescript/no-explicit-any
    return (value: any, items: any) => {
      const raw = items?.[0]?.payload?.[xAxisKey as string]
      return fmt(raw ?? value)
    }
  }, [labelFormatter, xAxisFormatter, xAxisKey])

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

  // Stable chart base — no dependency on activeCursorIndex or onDataIndexHover,
  // so it won't rebuild on every hover frame.
  const chartBase = useMemo(() => {
    const commonProps = {
      accessibilityLayer: true,
      data: data,
      margin: {
        left: showYAxis ? 4 : 24,
        right: 24,
        top: 24,
        bottom: showLegend ? 12 : undefined,
      },
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    }

    const grid =
      showGrid || !simple ? (
        <CartesianGrid
          horizontal={false}
          vertical={true}
          stroke={isDark ? '#222225' : '#ccc'}
          strokeDasharray="6 6"
          syncWithTicks={true}
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

    const markerRingColor = isDark ? '#3F3F46' : '#D4D4D8'
    const tooltip = (
      <ChartTooltip
        cursor={false}
        content={({
          active,
          payload,
          label,
          coordinate,
          accessibilityLayer,
          activeIndex,
        }) => {
          const marker = markers?.find(
            (m) => m.x === payload?.[0]?.payload?.[xAxisKey as string],
          )
          return (
            <ChartTooltipContent
              active={active}
              payload={payload}
              label={label}
              coordinate={coordinate}
              accessibilityLayer={accessibilityLayer}
              activeIndex={activeIndex}
              className="text-black dark:text-white"
              indicator="dot"
              labelFormatter={tooltipLabelFormatter}
              formatter={formatter}
              footer={marker && <MarkerTooltipRows marker={marker} />}
            />
          )
        }}
      />
    )

    const markerReferenceLines = markers?.flatMap((marker) => [
      <ReferenceLine
        key={`marker-line-${marker.x}`}
        x={marker.x}
        stroke={guideLineColor}
        strokeDasharray="6 6"
        shapeRendering="crispEdges"
        // Below areas (100), whose layer also draws the series stroke.
        zIndex={50}
      />,
      <ReferenceLine
        key={`marker-${marker.x}`}
        x={marker.x}
        stroke="none"
        // Card fill hides the line and area behind the ring.
        label={<MarkerDot fill="var(--card)" stroke={markerRingColor} />}
        zIndex={350}
      />,
    ])

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
          {markerReferenceLines}
          {series
            .slice()
            .reverse()
            .map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={`var(--color-${s.key})`}
                maxBarSize={8}
                radius={0}
                opacity={
                  activeSeries === null || activeSeries === s.key ? 1 : 0.3
                }
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
          {markerReferenceLines}
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
        {markerReferenceLines}
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
    tooltipLabelFormatter,
    formatter,
    series,
    primarySeries,
    showYAxis,
    showLegend,
    hasDecimalValues,
    gradientInfo,
    activeSeries,
    handleLegendClick,
    handleMouseMove,
    handleMouseLeave,
    id,
    markers,
    guideLineColor,
  ])

  // Cursor line is cheap and only depends on the active index.
  // Injected via cloneElement so chartBase stays stable on hover.
  const chartContent = useMemo(() => {
    if (!chartBase) return null
    const activeRow =
      activeCursorIndex != null ? data[activeCursorIndex] : undefined
    if (!activeRow) return chartBase
    const activeX = activeRow[xAxisKey as string] as string | number
    const activeMarkerColor = isDark ? '#A1A1AA' : '#52525B'
    const cursorLine = markers?.some((m) => m.x === activeX) ? (
      <ReferenceLine
        key="active-marker"
        x={activeX}
        stroke={activeMarkerColor}
        shapeRendering="crispEdges"
        label={<MarkerDot fill={activeMarkerColor} r={4} />}
      />
    ) : (
      <ReferenceLine
        key="cursor"
        x={activeX}
        stroke={guideLineColor}
        strokeWidth={1}
        // Below series lines (400), above areas (100).
        zIndex={350}
      />
    )
    // Spread the original children without React.Children.toArray so that
    // existing keys are preserved and Recharts doesn't remount/re-animate.
    const originalChildren: React.ReactNode = chartBase.props.children
    return React.cloneElement(
      chartBase,
      {},
      ...(Array.isArray(originalChildren)
        ? originalChildren
        : [originalChildren]),
      cursorLine,
    )
  }, [
    chartBase,
    activeCursorIndex,
    data,
    xAxisKey,
    isDark,
    markers,
    guideLineColor,
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
