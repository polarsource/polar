'use client'

import Spinner from '@/components/Shared/Spinner'
import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import {
  CHART_RANGES,
  ChartRange,
  getFormattedMetricValue,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import MetricChart from './MetricChart'

interface MetricChartBoxProps {
  metric: keyof schemas['Metrics']
  onMetricChange?: (metric: keyof schemas['Metrics']) => void
  data?: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  range?: ChartRange
  onRangeChange?: (range: ChartRange) => void
  className?: string
  height?: number
  loading?: boolean
  compact?: boolean
}

const MetricChartBox: React.FC<MetricChartBoxProps> = ({
  metric,
  onMetricChange,
  data,
  previousData,
  interval,
  range,
  onRangeChange,
  className,
  height = 300,
  loading,
  compact = false,
}) => {
  const selectedMetric = useMemo(() => data?.metrics[metric], [data, metric])
  const [hoveredPeriod, setHoveredPeriod] =
    React.useState<ParsedMetricPeriod | null>(null)

  const metricValue = useMemo(() => {
    if (!data) return 0

    const currentPeriod = hoveredPeriod
      ? hoveredPeriod
      : data.periods[data.periods.length - 1]

    const value = hoveredPeriod ? currentPeriod[metric] : data.totals[metric]

    return getFormattedMetricValue(data.metrics[metric], value)
  }, [hoveredPeriod, data, metric])

  return (
    <ShadowBox
      className={twMerge(
        'dark:bg-polar-800 flex flex-col bg-gray-50 p-2 shadow-sm',
        className,
      )}
    >
      <div
        className={twMerge(
          'flex flex-row justify-between',
          compact ? 'p-4' : 'p-6',
        )}
      >
        <div
          className={twMerge(
            'flex w-full',
            compact
              ? 'flex-row items-center justify-between gap-x-4'
              : 'flex-col gap-y-3',
          )}
        >
          {onMetricChange ? (
            <Select value={metric} onValueChange={onMetricChange}>
              <SelectTrigger className="h-fit w-fit border-0 border-none bg-transparent p-0 shadow-none ring-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent">
                <SelectValue placeholder="Select a metric" />
              </SelectTrigger>
              <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
                {data &&
                  Object.values(data.metrics).map((metric) => (
                    <SelectItem key={metric.slug} value={metric.slug}>
                      {metric.display_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <h3 className={compact ? 'text-base' : 'text-lg'}>
              {selectedMetric?.display_name}
            </h3>
          )}
          <h2 className={compact ? 'text-base' : 'text-3xl'}>{metricValue}</h2>
          {!compact && (
            <div className="flex flex-row items-center gap-x-6">
              <div className="flex flex-row items-center gap-x-2">
                <span className="h-3 w-3 rounded-full border-2 border-blue-500" />
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  Current Period
                </span>
              </div>
              {previousData && (
                <div className="flex flex-row items-center gap-x-2">
                  <span className="dark:border-polar-600 h-3 w-3 rounded-full border-2 border-gray-500" />
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    Previous Period
                  </span>
                </div>
              )}
              {hoveredPeriod && (
                <div className="flex flex-row items-center gap-x-2">
                  <span className="h-3 w-3 rounded-full border-2 border-gray-500 dark:border-gray-700" />
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    <FormattedDateTime
                      datetime={hoveredPeriod.timestamp}
                      dateStyle="medium"
                    />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {range && onRangeChange && (
          <Tabs
            value={range}
            onValueChange={(value) => onRangeChange(value as ChartRange)}
          >
            <TabsList className="dark:bg-polar-900 flex flex-row gap-x-0 rounded-md bg-white">
              {Object.entries(CHART_RANGES).map(([key, value]) => (
                <TabsTrigger
                  size="small"
                  key={key}
                  value={key}
                  className="!rounded-sm p-1 px-2 text-xs font-normal"
                >
                  {value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>
      <div
        className={twMerge(
          'dark:bg-polar-900 flex flex-col gap-y-2 rounded-3xl bg-white',
          compact ? 'p-2' : 'p-4',
        )}
      >
        {loading ? (
          <div
            style={{ height }}
            className="flex flex-col items-center justify-center"
          >
            <Spinner />
          </div>
        ) : data && selectedMetric ? (
          <MetricChart
            height={height}
            data={data.periods}
            previousData={previousData?.periods}
            interval={interval}
            metric={selectedMetric}
            onDataIndexHover={(period) =>
              setHoveredPeriod(data.periods[period as number] ?? null)
            }
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height }}
          >
            <span className="text-lg">No data available</span>
          </div>
        )}
      </div>
    </ShadowBox>
  )
}

export default MetricChartBox
