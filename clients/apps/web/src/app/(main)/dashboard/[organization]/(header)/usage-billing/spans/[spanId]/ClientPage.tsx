'use client'

import Chart from '@/components/Chart/Chart'
import { CustomerStatBox } from '@/components/Customer/CustomerStatBox'
import { Events } from '@/components/Events/Events'
import { useEventDisplayName } from '@/components/Events/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { endOfToday, format, subMonths } from 'date-fns'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  const firstStat = hierarchyStats?.totals?.[0]
  const eventName = firstStat?.name ?? ''
  const eventLabel = firstStat?.label ?? eventName
  const eventDisplayName = useEventDisplayName(eventLabel)

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
        `/dashboard/${organization.slug}/usage-billing/spans/${spanId}?${params}`,
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
        `/dashboard/${organization.slug}/usage-billing/spans/${spanId}?${params}`,
      )
    },
    [router, organization, spanId, startDate, endDate],
  )

  const [hasScrolled, setHasScrolled] = useState(false)

  const {
    isShown: isEditEventTypeModalShown,
    show: showEditEventTypeModal,
    hide: hideEditEventTypeModal,
  } = useModal()

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop > 0 && !hasScrolled) {
        setHasScrolled(true)
      } else if (event.currentTarget.scrollTop === 0 && hasScrolled) {
        setHasScrolled(false)
      }
    },
    [hasScrolled],
  )

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
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <div>Spans (Root events)</div>
          </div>
          <div
            className={twMerge(
              'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
              hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
            )}
            onScroll={handleScroll}
          >
            <div className="flex h-full grow flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Timeline</h3>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={onDateRangeChange}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Interval</h3>
                <IntervalPicker
                  interval={interval}
                  onChange={onIntervalChange}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
              <div className="dark:border-polar-700 -mx-4 border-t border-gray-200" />
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Events</h3>
                <List size="small" className="rounded-xl">
                  {hierarchyStats?.totals?.map((stat) => (
                    <ListItem
                      key={stat.name}
                      size="small"
                      className="justify-between px-3"
                      inactiveClassName="text-gray-500 dark:text-polar-500"
                      selected={spanId === stat.event_type_id}
                      onSelect={() => {
                        const params = new URLSearchParams()
                        if (startDate) {
                          params.set('startDate', startDate.toISOString())
                        }
                        if (endDate) {
                          params.set('endDate', endDate.toISOString())
                        }
                        params.set('interval', interval)

                        if (spanId === stat.event_type_id) {
                          router.push(
                            `/dashboard/${organization.slug}/usage-billing/spans?${params}`,
                          )
                        } else {
                          router.push(
                            `/dashboard/${organization.slug}/usage-billing/spans/${spanId}?${params}`,
                          )
                        }
                      }}
                    >
                      <span className="truncate">
                        {stat.label || stat.name}
                      </span>
                      <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                        {Number(stat.occurrences).toLocaleString('en-US', {
                          style: 'decimal',
                          compactDisplay: 'short',
                          notation: 'compact',
                        })}
                      </span>
                    </ListItem>
                  ))}
                </List>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-row items-center justify-between gap-y-4">
        <h3 className="text-4xl">{eventDisplayName}</h3>
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
          <EditEventTypeModal
            eventTypeId={spanId}
            eventName={eventName}
            currentLabel={eventLabel}
            hide={hideEditEventTypeModal}
          />
        }
      />
    </DashboardBody>
  )
}
