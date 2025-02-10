'use client'

import Spinner from '@/components/Shared/Spinner'
import { ParsedMetricPeriod } from '@/hooks/queries'
import {
  computeCumulativeValue,
  dateToInterval,
  metricDisplayNames,
  MetricMarksResolver,
} from '@/utils/metrics'
import { components } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import MetricChart from './MetricChart'

interface MetricChartBoxProps {
  className?: string
  data: ParsedMetricPeriod[]
  interval: components['schemas']['TimeInterval']
  metric?: components['schemas']['Metric']
  height?: number
  maxTicks?: number
  marks?: MetricMarksResolver
  loading?: boolean
  defaultMetric?: keyof components['schemas']['Metrics']
  compact?: boolean
}

const MetricChartBox: React.FC<MetricChartBoxProps> = ({
  className,
  data,
  metric,
  height = 300,
  maxTicks,
  marks,
  loading,
  compact = false,
  defaultMetric,
}) => {
  const [selectedMetric, setSelectedMetric] = React.useState<
    keyof components['schemas']['Metrics'] | undefined
  >(defaultMetric)

  const [hoveredMetricPeriod, setHoveredMetricPeriod] =
    React.useState<ParsedMetricPeriod | null>(null)

  const isMetricObject = metric && 'slug' in metric

  const metricValue = useMemo(() => {
    if (!data || !metric) return 0

    const currentMetric = isMetricObject
      ? metric
      : selectedMetric
        ? metric[selectedMetric]
        : undefined

    if (!currentMetric) return 0

    const currentMetricPeriod = hoveredMetricPeriod
      ? hoveredMetricPeriod
      : data[data.length - 1]

    const value = hoveredMetricPeriod
      ? (currentMetricPeriod[
          currentMetric.slug as keyof ParsedMetricPeriod
        ] as number)
      : computeCumulativeValue(
          currentMetric,
          data.map((period) => {
            const value = period[currentMetric.slug as keyof ParsedMetricPeriod]
            return typeof value === 'number' ? value : 0
          }),
        )

    if (currentMetric?.type === 'currency') {
      return `$${getCentsInDollarString(value ?? 0)}`
    } else {
      return value
    }
  }, [hoveredMetricPeriod, data, selectedMetric])

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
          {!isMetricObject ? (
            <Select
              value={selectedMetric}
              onValueChange={(value) =>
                setSelectedMetric(
                  value as keyof components['schemas']['Metrics'],
                )
              }
            >
              <SelectTrigger className="h-fit w-fit border-0 border-none bg-transparent p-0 shadow-none ring-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent">
                <SelectValue placeholder="Select a metric" />
              </SelectTrigger>
              <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
                {Object.entries(metricDisplayNames).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h3 className={compact ? 'text-base' : 'text-lg'}>
              {metric.display_name}
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
              {hoveredMetricPeriod && (
                <div className="flex flex-row items-center gap-x-2">
                  <span className="h-3 w-3 rounded-full border-2 border-gray-500 dark:border-gray-700" />
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    <FormattedDateTime
                      datetime={hoveredMetricPeriod.timestamp}
                      dateStyle="medium"
                    />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
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
        ) : data && metric ? (
          <MetricChart
            height={height}
            data={data}
            interval={dateToInterval(data[0].timestamp)}
            marks={marks}
            maxTicks={maxTicks}
            metric={
              isMetricObject
                ? metric
                : metric[
                    selectedMetric as keyof components['schemas']['Metrics']
                  ]
            }
            onDataIndexHover={(period) =>
              setHoveredMetricPeriod(data[period as number] ?? null)
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
