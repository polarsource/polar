'use client'

import Spinner from '@/components/Shared/Spinner'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue } from '@/utils/metrics'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import MetricChart from './MetricChart'
import { ShareChartModal } from './ShareChartModal'

interface MetricOption {
  slug: keyof schemas['Metrics']
  display_name: string
}

interface MetricChartBoxProps {
  metric: keyof schemas['Metrics']
  onMetricChange?: (metric: keyof schemas['Metrics']) => void
  data?: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  className?: string
  height?: number
  width?: number
  loading?: boolean
  compact?: boolean
  shareable?: boolean
  simple?: boolean
  chartType?: 'line' | 'bar'
  /** Override the list of metrics shown in the dropdown. If not provided, uses metrics from data. */
  availableMetrics?: MetricOption[]
}

const EXPERIMENTAL_METRICS: Record<string, { tooltip: string }> = {
  churn_rate: {
    tooltip:
      'Churn rate values vary based on the selected time interval. For best results, use monthly or longer intervals.',
  },
  ltv: {
    tooltip:
      'LTV is based on Churn Rate, and values vary based on the selected interval. For best results, use monthly or longer intervals.',
  },
}

const MetricChartBox = ({
  ref,
  metric,
  onMetricChange,
  data,
  previousData,
  interval,
  className,
  height = 300,
  width,
  loading,
  compact = false,
  shareable = true,
  simple = false,
  chartType = 'line',
  availableMetrics,
}: MetricChartBoxProps & {
  ref?: React.RefObject<HTMLDivElement>
}) => {
  const { isShown: isModalOpen, show: showModal, hide: hideModal } = useModal()

  const startDate = useMemo(() => {
    if (!data || !data.periods.length) return null
    return data.periods[0].timestamp
  }, [data])
  const endDate = useMemo(() => {
    if (!data || !data.periods.length) return null
    return data.periods[data.periods.length - 1].timestamp
  }, [data])
  const previousStartDate = useMemo(() => {
    if (!previousData || !previousData.periods.length) return null
    return previousData.periods[0].timestamp
  }, [previousData])
  const previousEndDate = useMemo(() => {
    if (!previousData || !previousData.periods.length) return null
    return previousData.periods[previousData.periods.length - 1].timestamp
  }, [previousData])

  const selectedMetric = useMemo(() => data?.metrics[metric], [data, metric])
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = React.useState<
    number | null
  >(null)

  const hoveredPeriod = useMemo(() => {
    if (!data || !hoveredPeriodIndex) return null
    return data.periods[hoveredPeriodIndex]
  }, [data, hoveredPeriodIndex])

  const hoveredPreviousPeriod = useMemo(() => {
    if (!previousData || !hoveredPeriodIndex) return null
    return previousData.periods[hoveredPeriodIndex]
  }, [previousData, hoveredPeriodIndex])

  const metricValue = useMemo(() => {
    if (!data) return 0
    const metricInfo = data.metrics[metric]
    if (!metricInfo) return 0

    const currentPeriod = hoveredPeriod
      ? hoveredPeriod
      : data.periods[data.periods.length - 1]

    const value = hoveredPeriod ? currentPeriod[metric] : data.totals[metric]

    return getFormattedMetricValue(metricInfo, value ?? 0)
  }, [hoveredPeriod, data, metric])

  const trend = useMemo(() => {
    if (!data || !previousData) return 0

    const currentPeriod =
      hoveredPeriod ?? data?.periods[data.periods.length - 1]
    const previousPeriod =
      hoveredPreviousPeriod ??
      previousData?.periods[previousData?.periods.length - 1]

    const currentValue = currentPeriod[metric] ?? 0
    const previousValue = previousPeriod[metric] ?? 0

    return ((currentValue - previousValue) / previousValue) * 100
  }, [data, previousData, hoveredPeriod, hoveredPreviousPeriod, metric])

  return (
    <ShadowBox
      ref={ref}
      className={twMerge(
        'dark:bg-polar-800 group flex w-full flex-col justify-between bg-gray-50 p-2 shadow-xs',
        className,
      )}
    >
      <div
        className={twMerge(
          'flex flex-col gap-6 md:flex-row md:items-start md:justify-between',
          compact ? 'p-4' : 'p-6',
        )}
      >
        <div
          className={twMerge(
            'flex w-full',
            compact
              ? 'flex-row items-center justify-between gap-x-4'
              : 'flex-col gap-y-4',
          )}
        >
          {onMetricChange ? (
            <div className="flex flex-row items-center gap-x-2">
              <Select value={metric} onValueChange={onMetricChange}>
                <SelectTrigger className="dark:hover:bg-polar-700 -mt-2 -ml-3 h-fit w-fit rounded-lg border-0 border-none bg-transparent px-3 py-2 shadow-none ring-0 transition-colors hover:bg-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
                  {availableMetrics
                    ? availableMetrics.map((m) => (
                        <SelectItem key={m.slug} value={m.slug}>
                          {m.display_name}
                        </SelectItem>
                      ))
                    : data &&
                      Object.values(data.metrics)
                        .filter(
                          (m): m is NonNullable<typeof m> =>
                            m !== null && m !== undefined,
                        )
                        .map((m) => (
                          <SelectItem key={m.slug} value={m.slug}>
                            {m.display_name}
                          </SelectItem>
                        ))}
                </SelectContent>
              </Select>
              {metric in EXPERIMENTAL_METRICS && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help">
                      <Status
                        status="Experimental"
                        className="bg-blue-100 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {EXPERIMENTAL_METRICS[metric]?.tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="flex flex-row items-center gap-x-2">
              <h3 className={compact ? 'text-base' : 'text-lg'}>
                {selectedMetric?.display_name}
              </h3>
              {metric in EXPERIMENTAL_METRICS && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help">
                      <Status
                        status="Experimental"
                        className="bg-blue-100 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {EXPERIMENTAL_METRICS[metric]?.tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          <h2 className={compact ? 'text-base' : 'text-5xl font-light'}>
            {metricValue}
          </h2>
          {!compact && (
            <div className="flex flex-col gap-x-6 gap-y-2 md:flex-row md:items-center">
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <span className="h-3 w-3 rounded-full border-2 border-blue-500" />
                {hoveredPeriod ? (
                  <FormattedDateTime
                    datetime={hoveredPeriod.timestamp}
                    dateStyle="medium"
                  />
                ) : (
                  <span className="dark:text-polar-500 text-gray-500">
                    {startDate && endDate && (
                      <FormattedInterval
                        startDatetime={startDate}
                        endDatetime={endDate}
                        hideCurrentYear={false}
                      />
                    )}
                  </span>
                )}
              </div>
              {previousData && (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <span className="dark:border-polar-600 h-3 w-3 rounded-full border-2 border-gray-500" />
                  {hoveredPreviousPeriod ? (
                    <FormattedDateTime
                      datetime={hoveredPreviousPeriod.timestamp}
                      dateStyle="medium"
                    />
                  ) : (
                    <span className="dark:text-polar-500 text-gray-500">
                      {previousStartDate && previousEndDate && (
                        <FormattedInterval
                          startDatetime={previousStartDate}
                          endDatetime={previousEndDate}
                          hideCurrentYear={false}
                        />
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-row items-center gap-x-4">
          {trend !== 0 && !isNaN(trend) && trend !== Infinity && (
            <Status
              status={
                trend > 0 ? `+${trend.toFixed(0)}%` : `${trend.toFixed(0)}%`
              }
              className={twMerge(
                'text-sm',
                trend > 0
                  ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                  : 'bg-red-100 text-red-500 dark:bg-red-950',
              )}
            />
          )}
          {shareable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden rounded-full opacity-0 transition-opacity group-hover:opacity-100 md:block"
                  onClick={showModal}
                >
                  <ArrowOutwardOutlined fontSize="small" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share Chart</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div
        className={twMerge(
          'dark:bg-polar-900 flex w-full flex-col gap-y-2 rounded-3xl bg-white',
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
            width={width}
            data={data.periods}
            previousData={previousData?.periods}
            interval={interval}
            metric={selectedMetric}
            onDataIndexHover={(period) => {
              setHoveredPeriodIndex(period)
            }}
            simple={simple}
            chartType={chartType}
          />
        ) : (
          <div
            className="flex w-full flex-col items-center justify-center"
            style={{ height }}
          >
            <span className="text-lg">No data available</span>
          </div>
        )}
      </div>
      {shareable && data && (
        <Modal
          title={`Share ${selectedMetric?.display_name} Metric`}
          className="lg:w-fit!"
          isShown={isModalOpen}
          hide={hideModal}
          modalContent={
            <ShareChartModal
              data={data}
              previousData={previousData}
              interval={interval}
              metric={selectedMetric?.slug as keyof schemas['Metrics']}
            />
          }
        />
      )}
    </ShadowBox>
  )
}

MetricChartBox.displayName = 'MetricChartBox'

export default MetricChartBox
