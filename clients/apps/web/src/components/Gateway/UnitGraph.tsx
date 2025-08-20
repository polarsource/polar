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
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricChartProps {
  ref: React.RefObject<HTMLDivElement>
  revenueData: { timestamp: Date; value: number }[]
  costData: { timestamp: Date; value: number }[]
  interval: schemas['TimeInterval']
  height?: number
  width?: number
  grid?: boolean
  onDataIndexHover?: (index: number | undefined) => void
  simple?: boolean
}

const MetricChart = forwardRef<HTMLDivElement, MetricChartProps>(
  (
    {
      revenueData,
      costData,
      interval,
      height: _height,
      width: _width,
      onDataIndexHover,
      simple = false,
    },
    ref,
  ) => {
    const { resolvedTheme } = useTheme()

    const isDark = resolvedTheme === 'dark'

    const timestampFormatter = getTimestampFormatter(interval)

    return (
      <ChartContainer
        ref={ref}
        style={{ height: _height, width: _width }}
        config={{
          revenue: {
            label: 'Revenue',
            color: '#10b981',
          },
          cost: {
            label: 'Cost',
            color: '#ef4444',
          },
          metric: {
            label: 'Revenue vs. Cost',
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={revenueData.map((period, index) => ({
            ...period,
            revenue: period.value,
            cost: costData[index]?.value ?? 0,
          }))}
          margin={{
            left: 24,
            right: 24,
            top: 24,
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
          <ChartTooltip
            cursor={true}
            content={
              <ChartTooltipContent
                className="text-black dark:text-white"
                indicator="dot"
                labelKey="metric"
                formatter={(value, name) => {
                  const formattedValue = getFormattedMetricValue(
                    {
                      slug: 'revenue_vs_cost',
                      display_name: 'Revenue vs. Cost',
                      type: 'currency',
                    },
                    value as number,
                  )
                  return (
                    <div className="flex flex-row justify-between gap-x-8">
                      <div className="flex w-1/2 flex-row items-center gap-x-2">
                        <span
                          className={twMerge(
                            'h-2 w-2 rounded-full',
                            name === 'revenue'
                              ? 'bg-emerald-500 dark:bg-emerald-500'
                              : 'bg-red-500 dark:bg-red-500',
                          )}
                        />
                        <span className="capitalize">
                          {name.toString().split('_').join(' ')}
                        </span>
                      </div>
                      <span className="w-1/2 text-right">{formattedValue}</span>
                    </div>
                  )
                }}
              />
            }
          />
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
            interval="preserveStartEnd"
            tickFormatter={timestampFormatter}
          />
          <Line
            dataKey="cost"
            stroke="var(--color-cost)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            dataKey="revenue"
            stroke="var(--color-revenue)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ChartContainer>
    )
  },
)

MetricChart.displayName = 'MetricChart'

export default MetricChart
