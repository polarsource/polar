import {
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import Spinner from '../Shared/Spinner'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

export interface ChartProps<T extends Record<string, unknown>> {
  data: T[]
  series: ChartSeries[]
  height?: number
  width?: number
  xAxisKey: keyof T
  xAxisFormatter?: (value: T[keyof T]) => string
  yAxisFormatter?: (value: number) => string
  labelFormatter?: (value: T[keyof T]) => string
  showGrid?: boolean
  showLegend?: boolean
  showYAxis?: boolean
  loading?: boolean
}

export const Chart = <T extends Record<string, unknown>>({
  data,
  series,
  height,
  width,
  xAxisKey,
  xAxisFormatter,
  yAxisFormatter,
  labelFormatter,
  showGrid = true,
  showLegend = true,
  showYAxis = false,
  loading = false,
}: ChartProps<T>) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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

  const hasDecimalValues = useMemo(() => {
    return data.some((item) =>
      series.some((s) => {
        const value = item[s.key]
        return typeof value === 'number' && value % 1 !== 0
      }),
    )
  }, [data, series])

  return (
    <div className="dark:bg-polar-900 flex w-full flex-col gap-y-2 rounded-2xl bg-white px-4 pt-4">
      {loading ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center p-8"
        >
          <Spinner />
        </div>
      ) : (
        <ChartContainer
          style={{ height: height || 400, width: width || '100%' }}
          config={config}
        >
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: showYAxis ? 4 : 24,
              right: 24,
              top: 24,
              bottom: showLegend ? 12 : 24,
            }}
          >
            {showGrid && (
              <CartesianGrid
                horizontal={false}
                vertical={true}
                stroke={
                  isDark ? 'var(--color-polar-700)' : 'var(--color-gray-200)'
                }
                strokeDasharray="6 6"
              />
            )}
            <XAxis
              dataKey={xAxisKey as string}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="equidistantPreserveStart"
              tickFormatter={
                xAxisFormatter
                  ? (value) => xAxisFormatter(value as T[keyof T])
                  : undefined
              }
            />
            {showYAxis && (
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={hasDecimalValues}
                tickMargin={4}
                width="auto"
                tickFormatter={yAxisFormatter}
              />
            )}
            <ChartTooltip
              cursor={true}
              content={(props) => {
                if (!props.active || !props.payload?.length) return null

                const formattedLabel = labelFormatter
                  ? labelFormatter(props.label as T[keyof T])
                  : String(props.label)

                return (
                  <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                    <div className="mb-1 font-medium">{formattedLabel}</div>
                    <div className="grid gap-1.5">
                      {props.payload.map((item) => {
                        const itemConfig = config[item.dataKey as string]
                        const label = itemConfig?.label || item.name
                        const formattedValue = yAxisFormatter
                          ? yAxisFormatter(item.value as number)
                          : String(item.value)

                        return (
                          <div
                            key={item.dataKey}
                            className="flex items-center gap-2"
                          >
                            <div
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-muted-foreground">
                              {label}
                            </span>
                            <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                              {formattedValue}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={`var(--color-${s.key})`}
                type="linear"
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}
