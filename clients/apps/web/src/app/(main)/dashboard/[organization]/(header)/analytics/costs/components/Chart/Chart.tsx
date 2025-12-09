import {
  GenericChart,
  GenericChartSeries,
} from '@/components/Charts/GenericChart'
import Spinner from '@/components/Shared/Spinner'

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
  showGrid = true,
  showLegend = true,
  showYAxis = false,
  loading = false,
}: ChartProps<T>) => {
  const genericSeries: GenericChartSeries[] = series.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
  }))

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
        <GenericChart
          data={data}
          series={genericSeries}
          xAxisKey={xAxisKey as string}
          xAxisFormatter={
            xAxisFormatter
              ? (value) => xAxisFormatter(value as T[keyof T])
              : undefined
          }
          valueFormatter={yAxisFormatter}
          height={height || 400}
          width={width}
          showGrid={showGrid}
          showYAxis={showYAxis}
          showLegend={showLegend}
        />
      )}
    </div>
  )
}
