'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useEventTypes } from '@/hooks/queries/event_types'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { fromISODate, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import { endOfDay, format, subMonths } from 'date-fns'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'
import { Chart } from '../components/Chart/Chart'
import { CostsBandedChart } from '../components/CostsBandedChart'
import {
  DEFAULT_INTERVAL,
  getDefaultEndDate,
  getDefaultStartDate,
} from '../utils'
import CostsEventsTable from './CostsEventsTable'
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
    limit: PAGE_SIZE,
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
    <div>
      <div className="-mt-1 mb-11 flex flex-row items-center justify-between gap-y-4">
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h3 className="text-2xl font-medium whitespace-nowrap dark:text-white">
          {eventType?.label ?? ''}
        </h3>
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
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <h3 className="text-lg font-medium">Occurrences</h3>
                  {/* eslint-disable-next-line no-restricted-syntax */}
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
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <h3 className="text-lg font-medium">Cost</h3>
                  <dl className="flex flex-row gap-x-6">
                    <div className="flex flex-row gap-x-2">
                      <dt className="dark:text-polar-500 text-gray-500">
                        Total
                      </dt>
                      <dd className="tabular-nums">
                        {formatCurrency('subcent')(
                          costMetrics.totalCost,
                          'usd',
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-row gap-x-2">
                      <dt className="dark:text-polar-500 text-gray-500">
                        Average
                      </dt>
                      <dd className="tabular-nums">
                        {formatCurrency('subcent')(
                          costMetrics.averageCost,
                          'usd',
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <CostsEventsTable
          organization={organization}
          spanId={spanId}
          events={events}
          eventTypes={eventTypes}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
        />
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
    </div>
  )
}
