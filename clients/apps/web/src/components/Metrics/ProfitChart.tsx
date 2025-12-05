import { ParsedMetricsResponse } from '@/hooks/queries'
import {
  getFormattedMetricValue,
  getTickFormatter,
  getTimestampFormatter,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useTheme } from 'next-themes'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

interface ProfitChartProps {
  ref: React.RefObject<HTMLDivElement>
  data?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  height?: number
  grid?: boolean
  onDataIndexHover?: (index: number | undefined) => void
  simple?: boolean
  className?: string
  loading?: boolean
}

const ProfitChart = forwardRef<HTMLDivElement, ProfitChartProps>(
  (
    {
      data,
      interval,
      height: _height,
      onDataIndexHover,
      simple = false,
      className,
      loading,
    },
    ref,
  ) => {
    const { resolvedTheme } = useTheme()

    const isDark = resolvedTheme === 'dark'

    const timestampFormatter = getTimestampFormatter(interval)

    return (
      <ShadowBox
        className={twMerge(
          'dark:bg-polar-800 flex w-full flex-col bg-gray-50 p-2 shadow-xs',
          className,
        )}
      >
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-y-4">
            <h3 className="text-xl">Profit</h3>
            <h3 className="text-5xl font-light">
              {formatCurrencyAndAmount(
                data
                  ? (data.totals.revenue ?? 0) - (data.totals.costs ?? 0)
                  : 0,
                'usd',
              )}
            </h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Calculated as Revenue minus Costs
            </p>
          </div>
        </div>
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-2 rounded-3xl bg-white py-4 pr-4">
          {loading ? (
            <div
              style={{ height: _height }}
              className="flex flex-col items-center justify-center"
            >
              <Spinner />
            </div>
          ) : (
            <ChartContainer
              ref={ref}
              style={{ height: _height, width: '100%' }}
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
                  color: '#0062FF',
                },

                metric: {
                  label: 'Revenue vs. Cost',
                },
              }}
            >
              <LineChart
                accessibilityLayer
                data={data?.periods.map((period) => ({
                  timestamp: period.timestamp,
                  revenue: period.revenue,
                  cost: period.costs,
                  profit: (period.revenue ?? 0) - (period.costs ?? 0),
                }))}
                margin={{
                  left: 24,
                  right: 24,
                  top: 24,
                }}
                onMouseMove={(state) => {
                  if (onDataIndexHover) {
                    onDataIndexHover(state.activeTooltipIndex as number)
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
                  content={({ payload }) => (
                    <div className="dark:bg-polar-800 flex w-48 flex-col gap-y-2 rounded-md bg-white p-2 text-black shadow-xl dark:text-white">
                      <span>Revenue vs. Cost</span>
                      <div className="flex flex-col">
                        {payload?.map((item, index, array) => (
                          <div
                            key={item.name}
                            className={twMerge(
                              'flex w-full flex-row justify-between gap-x-2',
                              index === array.length - 1 &&
                                'dark:border-polar-600 mt-2 border-t border-gray-200 pt-2',
                            )}
                          >
                            <div className="flex flex-row items-center gap-x-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: item?.color,
                                }}
                              />
                              <span className="capitalize">
                                {item.name?.toString().split('_').join(' ')}
                              </span>
                            </div>
                            <span>
                              {getFormattedMetricValue(
                                {
                                  slug: 'revenue_vs_cost',
                                  display_name: 'Revenue vs. Cost',
                                  type: 'currency',
                                },
                                item.value as number,
                              )}
                            </span>
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
                    stroke={isDark ? '#222225' : '#ddd'}
                    strokeDasharray="6 6"
                  />
                )}
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    getTickFormatter({
                      slug: 'currency',
                      display_name: 'Currency',
                      type: 'currency',
                    })(value)
                  }
                  domain={[0, 'auto']}
                />
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
                  strokeWidth={2}
                  activeDot={false}
                  dot={false}
                  type="linear"
                />
                <Line
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  activeDot={false}
                  dot={false}
                  type="linear"
                />
                <Line
                  dataKey="profit"
                  stroke="var(--color-profit)"
                  type="linear"
                  strokeWidth={2}
                  activeDot={false}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </ShadowBox>
    )
  },
)

ProfitChart.displayName = 'ProfitChart'

export default ProfitChart
