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
          profit: {
            label: 'Profit',
            color: '#6366f1',
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
            profit: period.value - (costData[index]?.value ?? 0),
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
            includeHidden
            content={({payload}) => (
              <div
                className="text-black dark:text-white w-48 dark:bg-polar-800 bg-white shadow-xl rounded-md flex-col gap-y-2 flex p-2"
              >
                <span>Revenue vs. Cost</span>
                <div className="flex flex-col">
                {payload?.map((item, index, array) => (
                  <div key={item.name} className={twMerge(
                    'flex flex-row justify-between gap-x-2 w-full',
                    index === array.length - 1 && 'border-t border-gray-200 dark:border-polar-600 pt-2 mt-2',
                  )}>
                      <div className="flex flex-row items-center gap-x-2">
                        <span
                          className={twMerge(
                            'h-2 w-2 rounded-full',
                            index === array.length - 1 && 'hidden',
                          )}
                          style={{
                            backgroundColor: item?.color,
                          }}
                        />
                        <span className="capitalize">
                          {item.name?.toString().split('_').join(' ')}
                        </span>
                      </div>
                      <span className="">{getFormattedMetricValue({
                        slug: 'revenue_vs_cost',
                        display_name: 'Revenue vs. Cost',
                        type: 'currency',
                      }, item.value as number)}</span>
                    </div>
                ))}
                </div>
              </div>
            )}
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
            interval="equidistantPreserveStart"
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
          <Line
            dataKey="profit"
            hide
          />
        </LineChart>
      </ChartContainer>
    )
  },
)

MetricChart.displayName = 'MetricChart'

export default MetricChart
