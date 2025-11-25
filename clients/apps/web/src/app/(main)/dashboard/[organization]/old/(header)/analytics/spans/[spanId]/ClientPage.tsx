'use client'

import Chart from '@/components/Chart/Chart'
import { CustomerStatBox } from '@/components/Customer/CustomerStatBox'
import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useEventTypes } from '@/hooks/queries/event_types'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { endOfToday, format, subMonths } from 'date-fns'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { SpansSidebar } from '../SpansSidebar'
import { getSearchParams } from '../utils'
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
  const router = useRouter()

  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(toISODate(subMonths(endOfToday(), 1))),
  )
  const [endDateISOString, setEndDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(toISODate(endOfToday())),
  )

  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
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
    ] as const).withDefault('day'),
  )

  const {
    data: eventsData,
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

  const { data: hierarchyStats } = useEventHierarchyStats(
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

  const costMetrics = useMemo(() => {
    if (!hierarchyStats?.totals || hierarchyStats.totals.length === 0) {
      return {
        totalOccurrences: 0,
        totalCost: 0,
        averageCost: 0,
      }
    }

    const stat = hierarchyStats.totals[0]
    const totalOccurrences = stat.occurrences || 0
    const totalCost = parseFloat(stat.totals?.['_cost_amount'] || '0')
    const averageCost = parseFloat(stat.averages?.['_cost_amount'] || '0')

    return {
      totalOccurrences,
      totalCost,
      averageCost,
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
        const p50 = parseFloat(stat.p50?.['_cost_amount'] || '0')
        const p95 = parseFloat(stat.p95?.['_cost_amount'] || '0')
        const p99 = parseFloat(stat.p99?.['_cost_amount'] || '0')

        return {
          date: format(new Date(period.timestamp), 'MMM d, yyyy'),
          timestamp: period.timestamp,
          average,
          p50,
          p95,
          p99,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [hierarchyStats])

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const params = getSearchParams(dateRange, interval)
      router.push(
        `/dashboard/${organization.slug}/analytics/spans/${spanId}?${params}`,
      )
    },
    [router, organization, spanId, interval],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        newInterval,
      )
      router.push(
        `/dashboard/${organization.slug}/analytics/spans/${spanId}?${params}`,
      )
    },
    [router, organization, spanId, startDate, endDate],
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

  return (
    <DashboardBody
      title="Span"
      className="flex flex-col gap-y-12"
      wide
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <SpansSidebar
          organization={organization}
          eventTypes={eventTypes?.items}
          dateRange={dateRange}
          interval={interval}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          onIntervalChange={onIntervalChange}
          selectedSpanId={spanId}
          title="Spans (Root events)"
        />
      }
    >
      <div className="flex flex-row items-center justify-between gap-y-4">
        <h3 className="text-4xl">{eventType?.label ?? ''}</h3>
        <Button variant="secondary" onClick={showEditEventTypeModal}>
          Edit
        </Button>
      </div>

      {events.length > 0 && chartData.length > 0 && (
        <div className="flex flex-col gap-y-6">
          <Chart
            data={chartData}
            series={[
              {
                key: 'average',
                label: 'Avg',
                color: '#8b5cf6',
              },
              {
                key: 'p50',
                label: 'P50',
                color: '#3b82f6',
              },
              {
                key: 'p95',
                label: 'P95',
                color: '#10b981',
              },
              {
                key: 'p99',
                label: 'P99',
                color: '#ef4444',
              },
            ]}
            xAxisKey="date"
            title="Costs"
            height={300}
            showYAxis={true}
            yAxisFormatter={(value) => formatSubCentCurrency(value)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CustomerStatBox title="Total occurrences" size="lg">
              {costMetrics.totalOccurrences.toLocaleString()}
            </CustomerStatBox>
            <CustomerStatBox title="Total cost" size="lg">
              {formatSubCentCurrency(costMetrics.totalCost)}
            </CustomerStatBox>
            <CustomerStatBox title="Average cost" size="lg">
              {formatSubCentCurrency(costMetrics.averageCost)}
            </CustomerStatBox>
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row justify-between">
            <h3 className="text-2xl">Spans</h3>
            <h3 className="dark:text-polar-500 text-2xl text-gray-400">
              {events.length}
              {hasNextPage ? '+' : ''} {events.length === 1 ? 'Span' : 'Spans'}
            </h3>
          </div>
          <div className="flex flex-col gap-y-3">
            <Events events={events} organization={organization} />
            {hasNextPage && (
              <Button
                className="self-start"
                variant="secondary"
                onClick={() => fetchNextPage()}
                loading={isFetching}
              >
                Load More
              </Button>
            )}
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
