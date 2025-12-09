'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useEventTypes } from '@/hooks/queries/event_types'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, getTimestampFormatter, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { endOfDay, format, subMonths } from 'date-fns'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { Chart } from '../components/Chart/Chart'
import { CostsBandedChart } from '../components/CostsBandedChart'
import { SpansHeader } from '../components/SpansHeader'
import { SpansTitle } from '../components/SpansTitle'
import {
  DEFAULT_INTERVAL,
  getDefaultEndDate,
  getDefaultStartDate,
} from '../utils'
import { EventRow } from './components/EventRow'
import {
  generateDateRange,
  groupEmptyDates,
  groupEventsByDay,
} from './components/utils'
import { EditEventTypeModal } from './EditEventTypeModal'

const PAGE_SIZE = 50

interface SpanDetailPageProps {
  organization: schemas['Organization']
  spanId: string
}

export default function SpanDetailPage({
  organization,
  spanId,
}: SpanDetailPageProps) {
  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )
  const [endDateISOString, setEndDateISOString] = useQueryState(
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

  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as const).withDefault(DEFAULT_INTERVAL),
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
    limit: PAGE_SIZE,
    sorting: ['-timestamp'],
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
      },
      true,
    )

  const { data: eventTypes } = useEventTypes(organization.id, {
    sorting: ['-last_seen'],
    root_events: true,
    source: 'user',
  })

  const eventType = eventTypes?.items.find((item) => item.id === spanId)

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  const dayGroups = useMemo(() => {
    const eventsMap = groupEventsByDay(events)
    const dateRange = generateDateRange(startDate, endDate)
    const groups = groupEmptyDates(dateRange, eventsMap)

    // Remove the last group if it's an empty range (looks odd at the bottom)
    if (groups.length > 1 && groups[groups.length - 1].type === 'empty-range') {
      return groups.slice(0, -1)
    }

    return groups
  }, [events, startDate, endDate])

  const costMetrics = useMemo(() => {
    if (!hierarchyStats?.totals || hierarchyStats.totals.length === 0) {
      return {
        totalOccurrences: 0,
        totalCost: 0,
        averageCost: 0,
        p99Cost: 0,
      }
    }

    const stat = hierarchyStats.totals[0]
    const totalOccurrences = stat.occurrences || 0
    const totalCost = parseFloat(stat.totals?.['_cost_amount'] || '0')
    const averageCost = parseFloat(stat.averages?.['_cost_amount'] || '0')
    const p99Cost = parseFloat(stat.p99?.['_cost_amount'] || '0')

    return {
      totalOccurrences,
      totalCost,
      averageCost,
      p99Cost,
    }
  }, [hierarchyStats])

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

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDateISOString(toISODate(dateRange.from))
      setEndDateISOString(toISODate(dateRange.to))
    },
    [setStartDateISOString, setEndDateISOString],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      setInterval(newInterval)
    },
    [setInterval],
  )

  const {
    isShown: isEditEventTypeModalShown,
    show: showEditEventTypeModal,
    hide: hideEditEventTypeModal,
  } = useModal()

  if (!spanId) {
    return (
      <DashboardBody title="Span">
        <div className="flex flex-col gap-y-4">
          <p className="dark:text-polar-500 text-gray-500">
            No span ID provided
          </p>
        </div>
      </DashboardBody>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <DashboardBody
      title={<SpansTitle organization={organization} />}
      header={
        <SpansHeader
          dateRange={dateRange}
          interval={interval}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          onIntervalChange={onIntervalChange}
        />
      }
    >
      <div className="mb-12 flex flex-row items-center justify-between gap-y-4">
        <h3 className="text-4xl">{eventType?.label ?? ''}</h3>
        <Button variant="secondary" onClick={showEditEventTypeModal}>
          Edit
        </Button>
      </div>

      {events.length > 0 && chartData.length > 0 && (
        <div className="mb-8 flex flex-col gap-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="col-span-1">
              <div className="dark:bg-polar-700 rounded-3xl bg-gray-50 p-2">
                <div className="flex flex-row items-center justify-between px-3 pt-2 pb-4">
                  <h3 className="text-lg font-medium">Occurrences</h3>
                  <span className="tabular-nums">
                    {costMetrics.totalOccurrences}
                  </span>
                </div>
                <div>
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
              </div>
            </div>

            <div className="col-span-1 2xl:col-span-2">
              <div className="dark:bg-polar-700 rounded-3xl bg-gray-50 p-2">
                <div className="flex flex-row items-center justify-between px-3 pt-2 pb-4">
                  <h3 className="text-lg font-medium">Cost</h3>
                  <dl className="flex flex-row gap-x-6">
                    <div className="flex flex-row gap-x-2">
                      <dt className="dark:text-polar-500 text-gray-500">
                        Total
                      </dt>
                      <dd className="tabular-nums">
                        {formatSubCentCurrency(costMetrics.totalCost, 'usd')}
                      </dd>
                    </div>
                    <div className="flex flex-row gap-x-2">
                      <dt className="dark:text-polar-500 text-gray-500">
                        Average
                      </dt>
                      <dd className="tabular-nums">
                        {formatSubCentCurrency(costMetrics.averageCost, 'usd')}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <CostsBandedChart
                    data={chartData}
                    xAxisFormatter={(value) => timestampFormatter(value)}
                    yAxisFormatter={(value) =>
                      formatSubCentCurrency(value, 'usd')
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
              </div>
            </div>
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-3">
            <div className="dark:border-polar-700 w-full border-collapse overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full table-auto border-collapse rounded-lg">
                <thead>
                  <tr>
                    <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
                      Date
                    </th>
                    <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
                      Customer
                    </th>
                    <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
                      Timestamp
                    </th>
                    <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-right text-sm font-medium text-gray-600">
                      Cost
                    </th>
                  </tr>
                </thead>
                {dayGroups.map((group, groupIndex) => {
                  if (group.type === 'empty-range') {
                    return (
                      <tbody
                        key={`empty-${groupIndex}`}
                        className="dark:divide-polar-700 group divide-y divide-gray-200"
                      >
                        <tr className="dark:bg-polar-800 bg-gray-50 not-group-first-of-type:border-t">
                          <th
                            colSpan={4}
                            className="dark:text-polar-400 p-2 text-left text-sm font-medium text-gray-600"
                          >
                            <FormattedInterval
                              startDatetime={group.endDate}
                              endDatetime={group.startDate}
                            />
                          </th>
                        </tr>
                        <tr>
                          <td
                            colSpan={4}
                            className="dark:text-polar-600 p-2 text-center text-sm text-gray-400 italic"
                          >
                            No events
                          </td>
                        </tr>
                      </tbody>
                    )
                  }

                  return (
                    <tbody
                      key={`day-${group.date.toISOString()}`}
                      className="dark:divide-polar-700 group divide-y divide-gray-200"
                    >
                      <tr className="dark:bg-polar-800 bg-gray-50 not-group-first-of-type:border-t">
                        <th
                          colSpan={4}
                          className="dark:text-polar-400 p-2 text-left text-sm font-medium text-gray-600"
                        >
                          <FormattedInterval
                            startDatetime={group.date}
                            endDatetime={group.date}
                          />
                        </th>
                      </tr>
                      {group.events.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          organization={organization}
                          eventType={eventType}
                          averageCost={costMetrics.averageCost}
                          p99Cost={costMetrics.p99Cost}
                        />
                      ))}
                    </tbody>
                  )
                })}
                <tfoot>
                  <tr>
                    <td
                      colSpan={4}
                      className="dark:border-polar-700 border-t border-gray-200"
                    >
                      {hasNextPage ? (
                        <button
                          className="group dark:text-polar-500 dark:hover:bg-polar-700 dark:hover:text-polar-300 relative flex h-10 w-full cursor-pointer items-center justify-center gap-x-2 py-3 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                          onClick={() => fetchNextPage()}
                        >
                          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 transition-all duration-200 group-hover:opacity-0 group-hover:blur-[2px]">
                            Showing first {events.length} events
                          </span>
                          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 blur-[2px] transition-all duration-200 group-hover:opacity-100 group-hover:blur-none">
                            Load more
                          </span>
                        </button>
                      ) : (
                        <span className="group dark:text-polar-500/60 dark:bg-polar-800 relative flex h-10 w-full items-center justify-center gap-x-2 bg-gray-50 py-3 text-sm text-gray-400">
                          Showing all {events.length} events
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
          <h1 className="text-2xl font-normal">No Events Found</h1>
          <p className="dark:text-polar-500 text-gray-500">
            There are no events matching this span
          </p>
        </div>
      )}

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
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}
