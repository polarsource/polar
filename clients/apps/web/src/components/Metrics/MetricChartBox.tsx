'use client'

import { Spinner } from '@polar-sh/orbit'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue } from '@/utils/metrics'
import {
  ArrowDownRight,
  ArrowOutwardOutlined,
  ArrowUpRight,
  MoreVertOutlined,
} from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { Status } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import React, { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import MetricChart from './MetricChart'
import { ShareChartModal } from './ShareChartModal'

interface MetricChartBoxProps {
  metric: keyof schemas['Metrics']
  data?: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  className?: string
  chartClassName?: string
  height?: number
  width?: number
  loading?: boolean
  compact?: boolean
  shareable?: boolean
  exportable?: boolean
  simple?: boolean
  chartType?: 'line' | 'bar'
  /** Whose data this is, such as a customer's name. Shown before the metric title. */
  context?: string
  /** Controlled hover index — syncs cursor across charts in a group. */
  hoveredPeriodIndex?: number | null
  onHoverPeriodChange?: (index: number | null) => void
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
  data,
  previousData,
  interval,
  className,
  chartClassName,
  height = 300,
  width,
  loading,
  compact = false,
  shareable = true,
  exportable = true,
  simple = false,
  chartType = 'line',
  context,
  hoveredPeriodIndex: hoveredPeriodIndexProp,
  onHoverPeriodChange,
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
  const [hoveredPeriodIndexLocal, setHoveredPeriodIndexLocal] = React.useState<
    number | null
  >(null)
  const hoveredPeriodIndex =
    hoveredPeriodIndexProp !== undefined
      ? hoveredPeriodIndexProp
      : hoveredPeriodIndexLocal

  const handleDataIndexHover = useCallback(
    (period: number | null) => {
      setHoveredPeriodIndexLocal(period)
      onHoverPeriodChange?.(period)
    },
    [onHoverPeriodChange],
  )

  const handleExport = useCallback(() => {
    if (!data || !selectedMetric) return

    const rows = [
      ['Timestamp', selectedMetric.display_name],
      ...data.periods.map((period) => [
        period.timestamp.toISOString(),
        String(period[metric] ?? ''),
      ]),
    ]
    const csv = rows.map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `polar-${metric}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, metric, selectedMetric])

  const hoveredPeriod = useMemo(() => {
    if (!data || hoveredPeriodIndex == null) return null
    return data.periods[hoveredPeriodIndex]
  }, [data, hoveredPeriodIndex])

  const hoveredPreviousPeriod = useMemo(() => {
    if (!previousData || hoveredPeriodIndex == null) return null
    return previousData.periods[hoveredPeriodIndex]
  }, [previousData, hoveredPeriodIndex])

  const metricValue = useMemo(() => {
    if (!data) return 0
    const metricInfo = data.metrics[metric]
    if (!metricInfo) return 0

    const value = hoveredPeriod ? hoveredPeriod[metric] : data.totals[metric]

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
    <div
      ref={ref}
      className={twMerge(
        'group relative flex w-full flex-col justify-between gap-y-4 p-6',
        className,
      )}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      <div
        className={twMerge(
          'flex flex-row items-start justify-between gap-6',
          loading && 'invisible',
        )}
      >
        <div
          className={twMerge(
            'flex w-full min-w-0',
            compact
              ? 'flex-row items-center justify-between gap-x-4'
              : 'flex-col gap-y-4',
          )}
        >
          <div className="flex flex-row items-center gap-x-2">
            <h3 className={compact ? 'text-base' : 'text-lg'}>
              {selectedMetric?.display_name}
              {context && !shareable && (
                <span className="dark:text-polar-500 ml-3 text-gray-500">
                  {context}
                </span>
              )}
            </h3>
            {metric in EXPERIMENTAL_METRICS && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help">
                    <Status status="Experimental" color="blue" size="small" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {EXPERIMENTAL_METRICS[metric]?.tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Text
            as="h2"
            variant={compact ? 'default' : 'heading-l'}
            weight="book"
          >
            {metricValue}
          </Text>
          {!compact && (
            <div className="flex flex-col gap-x-6 gap-y-2 md:flex-row md:items-center">
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <span className="h-0.5 w-3 bg-blue-600" />
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
                  <span className="dark:bg-polar-600 h-0.5 w-3 bg-gray-300" />
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

        <div className="flex shrink-0 flex-row items-center gap-x-4">
          {trend !== 0 && Number.isFinite(trend) && (
            <Box alignItems="center" columnGap="xs">
              <Box color={trend > 0 ? 'text-success' : 'text-danger'}>
                {trend > 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
              </Box>
              <Text variant="caption" tabularNums>
                {Math.abs(trend).toFixed(0)}%
              </Text>
            </Box>
          )}
          {shareable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden rounded-full opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                  onClick={showModal}
                >
                  <ArrowOutwardOutlined fontSize="small" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share Chart</TooltipContent>
            </Tooltip>
          )}
          {(shareable || exportable) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex rounded-full transition-opacity md:opacity-0 md:group-hover:opacity-100"
                >
                  <MoreVertOutlined fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {shareable && (
                  <DropdownMenuItem className="md:hidden" onClick={showModal}>
                    Share Chart
                  </DropdownMenuItem>
                )}
                {exportable && (
                  <DropdownMenuItem onClick={handleExport}>
                    Export
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className={twMerge('flex w-full flex-col gap-y-2', chartClassName)}>
        {loading ? (
          <div
            style={{ height }}
            className="flex flex-col items-center justify-center"
          />
        ) : data && selectedMetric ? (
          <MetricChart
            height={height}
            width={width}
            data={data.periods}
            previousData={previousData?.periods}
            interval={interval}
            metric={selectedMetric}
            onDataIndexHover={handleDataIndexHover}
            simple={simple}
            chartType={chartType}
            activeCursorIndex={hoveredPeriodIndex}
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
          title={`Share ${context ? `${context} ` : ''}${selectedMetric?.display_name} Metric`}
          className="lg:w-fit!"
          isShown={isModalOpen}
          hide={hideModal}
          modalContent={
            <ShareChartModal
              data={data}
              previousData={previousData}
              interval={interval}
              metric={selectedMetric?.slug as keyof schemas['Metrics']}
              context={context}
            />
          }
        />
      )}
    </div>
  )
}

MetricChartBox.displayName = 'MetricChartBox'

export default MetricChartBox
