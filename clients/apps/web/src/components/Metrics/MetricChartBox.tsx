'use client'

import Spinner from '@/components/Shared/Spinner'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue } from '@/utils/metrics'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import React, { useCallback, useMemo } from 'react'
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

const ACTION_BUTTON_CLASS =
  'hidden rounded-full opacity-0 transition-opacity group-hover:opacity-100 md:block'

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
    <div ref={ref} className={twMerge('group', className)}>
      <Box
        position="relative"
        display="flex"
        flexDirection="column"
        justifyContent="between"
        width="100%"
        backgroundColor="background-card"
        padding={compact ? 'l' : 'xl'}
      >
        {loading && (
          <Box
            position="absolute"
            inset={0}
            zIndex={10}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Spinner />
          </Box>
        )}

        <Box
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems={{ md: 'start' }}
          justifyContent={{ md: 'between' }}
          rowGap="xl"
          columnGap="xl"
          visibility={loading ? 'hidden' : 'visible'}
        >
          <Box
            display="flex"
            flexDirection={compact ? 'row' : 'column'}
            alignItems={compact ? 'center' : 'start'}
            justifyContent={compact ? 'between' : 'start'}
            columnGap={compact ? 'l' : 'none'}
            rowGap={compact ? 'none' : 'l'}
            width="100%"
          >
            <Box display="flex" alignItems="center" columnGap="s">
              {onMetricChange ? (
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
              ) : (
                <Text
                  as="h3"
                  variant={compact ? 'body' : 'heading-xxs'}
                  color="inherit"
                >
                  {selectedMetric?.display_name}
                </Text>
              )}
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
            </Box>

            <Text
              as="h2"
              variant={compact ? 'body' : 'heading-m'}
              color="inherit"
            >
              {metricValue}
            </Text>

            {!compact && (
              <Box
                display="flex"
                flexDirection={{ base: 'column', md: 'row' }}
                alignItems={{ md: 'center' }}
                columnGap="xl"
                rowGap="s"
              >
                <Box display="flex" alignItems="center" columnGap="s">
                  <span className="h-3 w-3 rounded-full border-2 border-blue-500" />
                  {hoveredPeriod ? (
                    <Text variant="default" color="inherit">
                      <FormattedDateTime
                        datetime={hoveredPeriod.timestamp}
                        dateStyle="medium"
                      />
                    </Text>
                  ) : (
                    <Text variant="default" color="muted">
                      {startDate && endDate && (
                        <FormattedInterval
                          startDatetime={startDate}
                          endDatetime={endDate}
                          hideCurrentYear={false}
                        />
                      )}
                    </Text>
                  )}
                </Box>
                {previousData && (
                  <Box display="flex" alignItems="center" columnGap="s">
                    <Box
                      width={12}
                      height={12}
                      borderRadius="full"
                      borderWidth={2}
                      borderStyle="solid"
                      borderColor="border-secondary"
                    />
                    {hoveredPreviousPeriod ? (
                      <Text variant="default" color="inherit">
                        <FormattedDateTime
                          datetime={hoveredPreviousPeriod.timestamp}
                          dateStyle="medium"
                        />
                      </Text>
                    ) : (
                      <Text variant="default" color="muted">
                        {previousStartDate && previousEndDate && (
                          <FormattedInterval
                            startDatetime={previousStartDate}
                            endDatetime={previousEndDate}
                            hideCurrentYear={false}
                          />
                        )}
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <Box display="flex" alignItems="center" columnGap="l">
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
                    className={ACTION_BUTTON_CLASS}
                    onClick={showModal}
                  >
                    <ArrowOutwardOutlined fontSize="small" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share Chart</TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={ACTION_BUTTON_CLASS}
                >
                  <MoreVertOutlined fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Box>
        </Box>

        <Box display="flex" flexDirection="column" rowGap="s" width="100%">
          {loading ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              height={height}
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
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              width="100%"
              height={height}
            >
              <Text variant="body" color="muted">
                No data available
              </Text>
            </Box>
          )}
        </Box>

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
      </Box>
    </div>
  )
}

MetricChartBox.displayName = 'MetricChartBox'

export default MetricChartBox
