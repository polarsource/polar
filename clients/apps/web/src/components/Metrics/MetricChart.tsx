import { ParsedMetricPeriod } from '@/hooks/queries'
import { getFormattedMetricValue, getTickFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
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
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricChartProps {
  data: ParsedMetricPeriod[]
  previousData?: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  metric: schemas['Metric']
  height?: number
  onDataIndexHover?: (index: number | undefined) => void
}

const MetricChart: React.FC<MetricChartProps> = ({
  data,
  previousData,
  interval,
  metric,
  height: _height,
  onDataIndexHover,
}) => {
  const { resolvedTheme } = useTheme()
  const mergedData = useMemo(() => {
    if (!data) {
      return undefined
    }
    return data.map((period, index) => ({
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
    }))
  }, [data, previousData, metric.slug])

  const isDark = resolvedTheme === 'dark'

  return (
    <ChartContainer
      style={{ height: _height }}
      config={{
        current: {
          label: 'Current',
          color: '#2563eb',
        },
        previous: {
          label: 'Previous',
          color: isDark ? '#383942' : '#ccc',
        },
        metric: {
          label: metric.display_name,
        },
      }}
    >
      <LineChart
        accessibilityLayer
        data={mergedData}
        margin={{
          left: 0,
          right: 12,
        }}
        onMouseMove={(state) => {
          if (onDataIndexHover) {
            onDataIndexHover(state.activeTooltipIndex)
          }
        }}
        onMouseLeave={() => {
          if (onDataIndexHover) {
            onDataIndexHover(undefined)
          }
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            switch (interval) {
              case 'hour':
                return value.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              case 'day':
              case 'week':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                })
              case 'month':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: '2-digit',
                })
              case 'year':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              default:
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                })
            }
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={getTickFormatter(metric)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="text-black dark:text-white"
              indicator="dot"
              labelKey="metric"
              formatter={(value, name) => {
                const formattedValue = getFormattedMetricValue(
                  metric,
                  value as number,
                )
                return (
                  <div className="flex flex-row justify-between gap-x-8">
                    <div className="flex flex-row items-center gap-x-2">
                      <span
                        className={twMerge(
                          'h-2 w-2 rounded-full',
                          name === 'current'
                            ? 'bg-primary dark:bg-primary'
                            : 'dark:bg-polar-500 bg-gray-500',
                        )}
                      />
                      <span className="capitalize">
                        {name.toString().split('_').join(' ')}
                      </span>
                    </div>
                    <span>{formattedValue}</span>
                  </div>
                )
              }}
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

export default MetricChart
