'use client'

import { Chart } from '@/components/Costs/Chart'
import { CostsBandedChart } from '@/components/Costs/CostsBandedChart'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { useEventTypes } from '@/hooks/queries/event_types'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { fromISODate, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { endOfDay, format, subDays, subMonths } from 'date-fns'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'
import {
  DEFAULT_INTERVAL,
  getDefaultEndDate,
  getDefaultStartDate,
} from '../utils'
import CostsEventsTable from './CostsEventsTable'
import { EditEventTypeModal } from './EditEventTypeModal'

interface SpanDetailPageProps {
  organization: schemas['Organization']
  spanId: string
}

export default function SpanDetailPage({
  organization,
  spanId,
}: SpanDetailPageProps) {
  const [startDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )
  const [endDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(getDefaultEndDate()),
  )

  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString
      ? endOfDay(fromISODate(endDateISOString))
      : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const [prevStart, prevEnd] = useMemo(() => {
    const durationMs = endDate.getTime() - startDate.getTime()
    const prevEnd = subDays(startDate, 1)
    const prevStart = new Date(prevEnd.getTime() - durationMs)
    return [prevStart, prevEnd]
  }, [startDate, endDate])

  const [interval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as const).withDefault(DEFAULT_INTERVAL),
  )

  const [customerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString),
  )

  const {
    data: eventsData,
    isLoading: isEventsLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    // @ts-expect-error - event_type_id is intentionally excluded from public schema
    event_type_id: spanId,
    limit: 50,
    sorting: ['-timestamp'],
    customer_id: customerIds,
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    aggregate_fields: ['_cost.amount'],
  })

  const { data: hierarchyStats, isLoading: isHierarchyLoading } =
    useEventHierarchyStats(
      organization.id,
      {
        event_type_id: spanId,
        start_date: startDateISOString,
        end_date: endDateISOString,
        interval,
        aggregate_fields: ['_cost.amount'],
        customer_id: customerIds,
      },
      true,
    )

  const { data: prevHierarchyStats } = useEventHierarchyStats(organization.id, {
    event_type_id: spanId,
    start_date: prevStart.toISOString().split('T')[0],
    end_date: prevEnd.toISOString().split('T')[0],
    interval,
    aggregate_fields: ['_cost.amount'],
    customer_id: customerIds,
  })

  const { data: eventTypesData } = useEventTypes(organization.id, {
    sorting: ['-last_seen'],
    root_events: true,
    source: 'user',
  })

  const eventTypes = eventTypesData?.items || []

  const eventType = eventTypes.find((item) => item.id === spanId)

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  const costMetrics = useMemo(() => {
    const zero = {
      totalOccurrences: 0,
      totalCost: 0,
      averageCost: 0,
      p99Cost: 0,
      totalCustomers: 0,
      costPerCustomer: 0,
      prevTotalOccurrences: 0,
      prevTotalCost: 0,
      prevAverageCost: 0,
      prevCostPerCustomer: 0,
    }

    if (!hierarchyStats?.totals || hierarchyStats.totals.length === 0)
      return zero

    const stat = hierarchyStats.totals[0]
    const totalOccurrences = stat.occurrences || 0
    const totalCost = parseFloat(stat.totals?.['_cost_amount'] || '0')
    const averageCost = parseFloat(stat.averages?.['_cost_amount'] || '0')
    const p99Cost = parseFloat(stat.p99?.['_cost_amount'] || '0')
    const totalCustomers = stat.customers || 0
    const costPerCustomer = totalCustomers > 0 ? totalCost / totalCustomers : 0

    const prevStat = prevHierarchyStats?.totals?.[0]
    const prevTotalOccurrences = prevStat?.occurrences || 0
    const prevTotalCost = parseFloat(prevStat?.totals?.['_cost_amount'] || '0')
    const prevAverageCost = parseFloat(
      prevStat?.averages?.['_cost_amount'] || '0',
    )
    const prevCustomers = prevStat?.customers || 0
    const prevCostPerCustomer =
      prevCustomers > 0 ? prevTotalCost / prevCustomers : 0

    return {
      totalOccurrences,
      totalCost,
      averageCost,
      p99Cost,
      totalCustomers,
      costPerCustomer,
      prevTotalOccurrences,
      prevTotalCost,
      prevAverageCost,
      prevCostPerCustomer,
    }
  }, [hierarchyStats, prevHierarchyStats])

  const chartData = useMemo(() => {
    if (!hierarchyStats?.periods || hierarchyStats.periods.length === 0)
      return []

    return hierarchyStats.periods
      .map((period) => {
        const stat = period.stats[0]
        if (!stat) return null

        const average = parseFloat(stat.averages?.['_cost_amount'] || '0')
        const p10 = parseFloat(stat.p10?.['_cost_amount'] || '0')
        const p90 = parseFloat(stat.p90?.['_cost_amount'] || '0')
        const p99 = parseFloat(stat.p99?.['_cost_amount'] || '0')
        const occurrences = stat.occurrences || 0

        return {
          date: format(new Date(period.timestamp), 'MMM d, yyyy'),
          timestamp: new Date(period.timestamp),
          average,
          p10,
          p90,
          p99,
          occurrences,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [hierarchyStats])

  const isLoading = isEventsLoading || isHierarchyLoading || !eventType

  const timestampFormatter = useMemo(
    () => getTimestampFormatter(interval),
    [interval],
  )

  const {
    isShown: isEditEventTypeModalShown,
    show: showEditEventTypeModal,
    hide: hideEditEventTypeModal,
  } = useModal()

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between gap-y-4">
        <div className="flex flex-col gap-y-2">
          <span className="dark:text-polar-500 text-lg text-gray-500">
            Event Span
          </span>
          <h3 className="text-2xl font-medium whitespace-nowrap dark:text-white">
            {eventType?.label ?? ''}
          </h3>
        </div>
        <Button variant="secondary" onClick={showEditEventTypeModal}>
          Edit
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex flex-col gap-y-8">
            <div className="grid grid-cols-4 gap-8">
              <StatisticCard title="Occurrences" size="lg">
                {costMetrics.totalOccurrences.toLocaleString()}
                <Trend
                  current={costMetrics.totalOccurrences}
                  prev={costMetrics.prevTotalOccurrences}
                  currentStart={startDate}
                  currentEnd={endDate}
                  prevStart={prevStart}
                  prevEnd={prevEnd}
                />
              </StatisticCard>
              <StatisticCard title="Total Cost" size="lg">
                {formatCurrency('subcent')(costMetrics.totalCost, 'usd')}
                <Trend
                  current={costMetrics.totalCost}
                  prev={costMetrics.prevTotalCost}
                  currentStart={startDate}
                  currentEnd={endDate}
                  prevStart={prevStart}
                  prevEnd={prevEnd}
                />
              </StatisticCard>
              <StatisticCard title="Average Cost" size="lg">
                {formatCurrency('subcent')(costMetrics.averageCost, 'usd')}
                <Trend
                  current={costMetrics.averageCost}
                  prev={costMetrics.prevAverageCost}
                  currentStart={startDate}
                  currentEnd={endDate}
                  prevStart={prevStart}
                  prevEnd={prevEnd}
                />
              </StatisticCard>
              <StatisticCard title="Cost per Customer" size="lg">
                {formatCurrency('subcent')(costMetrics.costPerCustomer, 'usd')}
                <Trend
                  current={costMetrics.costPerCustomer}
                  prev={costMetrics.prevCostPerCustomer}
                  currentStart={startDate}
                  currentEnd={endDate}
                  prevStart={prevStart}
                  prevEnd={prevEnd}
                />
              </StatisticCard>
            </div>

            {chartData.length > 0 && (
              <div className="dark:border-polar-700 rounded-xl border border-gray-200 p-2">
                <CostsBandedChart
                  data={chartData}
                  xAxisFormatter={(value) => timestampFormatter(value)}
                  yAxisFormatter={(value) =>
                    formatCurrency('subcent')(value, 'usd')
                  }
                  labelFormatter={(value) =>
                    value.toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  }
                  loading={isFetching}
                />
              </div>
            )}

            <CostsEventsTable
              organization={organization}
              spanId={spanId}
              events={events}
              eventTypes={eventTypes}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
            />
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          {chartData.length > 0 ? (
            <div className="dark:bg-polar-700 rounded-3xl bg-gray-50 p-2">
              <div className="px-3 pt-2 pb-4">
                <h3 className="text-lg font-medium">Occurrences</h3>
              </div>
              <Chart
                data={chartData}
                series={[
                  {
                    key: 'occurrences',
                    label: 'Occurrences',
                    color: '#2563eb',
                  },
                ]}
                xAxisKey="timestamp"
                xAxisFormatter={(value) =>
                  value instanceof Date
                    ? timestampFormatter(value)
                    : String(value)
                }
                labelFormatter={(value) =>
                  value instanceof Date
                    ? value.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : String(value)
                }
                showYAxis={true}
                yAxisFormatter={(value) => value.toLocaleString()}
                loading={isFetching}
              />
            </div>
          ) : (
            <div className="dark:border-polar-700 fl ex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
              <h1 className="text-2xl font-normal">No data</h1>
              <p className="dark:text-polar-500 text-gray-500">
                No metrics available for this period
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InlineModal
        isShown={isEditEventTypeModalShown}
        hide={hideEditEventTypeModal}
        modalContent={
          eventType ? (
            <EditEventTypeModal
              eventTypeId={spanId}
              eventName={eventType.name}
              currentLabel={eventType.label}
              currentLabelPropertySelector={
                eventType.label_property_selector ?? null
              }
              hide={hideEditEventTypeModal}
            />
          ) : null
        }
      />
    </div>
  )
}

function Trend({
  current,
  prev,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
}: {
  current: number
  prev: number
  currentStart: Date
  currentEnd: Date
  prevStart: Date
  prevEnd: Date
}) {
  if (prev === 0) return null
  const delta = current - prev
  const pct = (delta / prev) * 100
  const isUp = delta > 0
  const isDown = delta < 0
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`mt-1 flex w-fit cursor-default items-center gap-1 text-xs font-normal ${
            isUp
              ? 'text-red-500'
              : isDown
                ? 'text-emerald-500'
                : 'dark:text-polar-500 text-gray-400'
          }`}
        >
          {isUp ? (
            <ArrowUpRight className="size-3" />
          ) : isDown ? (
            <ArrowDownRight className="size-3" />
          ) : null}
          {Math.abs(pct).toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          %
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <span>
          {fmt(currentStart)} – {fmt(currentEnd)}
        </span>
        <span className="dark:text-polar-400 text-gray-400">
          vs {fmt(prevStart)} – {fmt(prevEnd)}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
