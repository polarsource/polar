'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import { useEventTypes } from '@/hooks/queries/event_types'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { parseSearchParams, serializeSearchParams } from '@/utils/datatable'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { operations, schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import { endOfToday, subMonths } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { SpansSidebar } from './SpansSidebar'
import { getSearchParams } from './utils'

const formatOccurrences = (value: number): string => {
  return value.toLocaleString('en-US')
}

type TimeSeriesField = 'average' | 'p95' | 'p99'

interface ClientPageProps {
  organization: schemas['Organization']
}

export default function ClientPage({ organization }: ClientPageProps) {
  const router = useRouter()

  const searchParams = useSearchParams()
  const dataTableParams = {
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    sorting: searchParams.getAll('sorting'),
  }
  const { sorting: costSorting } = parseSearchParams(dataTableParams)

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

  const sortingParam: operations['events:list_statistics_timeseries']['parameters']['query']['sorting'] =
    useMemo(() => {
      if (costSorting.length === 0) return ['-total'] as const
      return costSorting.map((s) =>
        s.desc ? `-${s.id}` : s.id,
      ) as operations['events:list_statistics_timeseries']['parameters']['query']['sorting']
    }, [costSorting])

  const { data: costData, isLoading: costDataLoading } = useEventHierarchyStats(
    organization.id,
    {
      start_date: startDateISOString,
      end_date: endDateISOString,
      interval,
      aggregate_fields: ['_cost.amount'],
      sorting: sortingParam,
    },
  )

  const { data: eventTypes } = useEventTypes(organization.id, {
    sorting: ['-last_seen'],
    root_events: true,
    source: 'user',
  })

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const params = getSearchParams(dateRange, interval)
      router.push(`/dashboard/${organization.slug}/analytics/costs?${params}`)
    },
    [router, organization, interval],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        newInterval,
      )
      router.push(`/dashboard/${organization.slug}/analytics/costs?${params}`)
    },
    [router, organization, startDate, endDate],
  )

  const getTimeSeriesValues = useCallback(
    (
      eventName: schemas['EventStatistics']['name'],
      field: TimeSeriesField,
    ): number[] => {
      if (!costData?.periods) return []

      return costData.periods.map((period) => {
        const eventStats = period.stats.find((stat) => stat.name === eventName)
        if (!eventStats) return 0

        if (field === 'average') {
          return parseFloat(eventStats.averages?.['_cost_amount'] || '0')
        } else if (field === 'p95') {
          return parseFloat(eventStats.p95?.['_cost_amount'] || '0')
        } else if (field === 'p99') {
          return parseFloat(eventStats.p99?.['_cost_amount'] || '0')
        }
        return 0
      })
    },
    [costData],
  )

  return (
    <DashboardBody
      title="Costs"
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
        />
      }
    >
      <div className="flex flex-col gap-y-6">
        <h3 className="text-2xl">Event Types</h3>
        <DataTable
          data={costData?.totals || []}
          isLoading={costDataLoading}
          sorting={costSorting}
          onSortingChange={(updaterOrValue) => {
            const updatedSorting =
              typeof updaterOrValue === 'function'
                ? updaterOrValue(costSorting)
                : updaterOrValue

            const sortingParams = serializeSearchParams(
              { pageIndex: 0, pageSize: 100 },
              updatedSorting,
            )
            router.push(
              `/dashboard/${organization.slug}/analytics/costs?${sortingParams}`,
            )
          }}
          onRowClick={(row) => {
            const params = getSearchParams(
              { from: startDate, to: endDate },
              interval,
            )
            router.push(
              `/dashboard/${organization.slug}/analytics/costs/${row.original.event_type_id}?${params}`,
            )
          }}
          columns={
            [
              {
                accessorKey: 'name',
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Name" />
                ),
                cell: ({ row }) => (
                  <span className="font-medium">
                    {row.original.label || row.original.name}
                  </span>
                ),
              },
              {
                id: 'total',
                accessorFn: (row) => row.totals?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Total Cost" />
                ),
                cell: ({ row }) =>
                  formatSubCentCurrency(
                    Number(row.original.totals?.['_cost_amount'] || 0),
                    'usd',
                  ),
              },
              {
                accessorKey: 'occurrences',
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Occurrences" />
                ),
                cell: ({ row }) => formatOccurrences(row.original.occurrences),
              },
              {
                id: 'average',
                accessorFn: (row) => row.averages?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Average Cost" />
                ),
                cell: ({ row }) => {
                  const values = getTimeSeriesValues(
                    row.original.name,
                    'average',
                  )
                  return (
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-28">
                        {formatSubCentCurrency(
                          Number(row.original.averages?.['_cost_amount'] || 0),
                          'usd',
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          trendUpIsBad={true}
                          width={80}
                          height={16}
                        />
                      )}
                    </div>
                  )
                },
              },
              {
                id: 'p95',
                accessorFn: (row) => row.p95?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="p95 Cost" />
                ),
                cell: ({ row }) => {
                  const values = getTimeSeriesValues(row.original.name, 'p95')
                  return (
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-28">
                        {formatSubCentCurrency(
                          Number(row.original.p95?.['_cost_amount'] || 0),
                          'usd',
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          trendUpIsBad={true}
                          width={80}
                          height={16}
                        />
                      )}
                    </div>
                  )
                },
              },
              {
                id: 'p99',
                accessorFn: (row) => row.p99?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="p99 Cost" />
                ),
                cell: ({ row }) => {
                  const values = getTimeSeriesValues(row.original.name, 'p99')
                  return (
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-28">
                        {formatSubCentCurrency(
                          Number(row.original.p99?.['_cost_amount'] || 0),
                          'usd',
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          trendUpIsBad={true}
                          width={80}
                          height={16}
                        />
                      )}
                    </div>
                  )
                },
              },
            ] as DataTableColumnDef<schemas['EventStatistics']>[]
          }
        />
      </div>
    </DashboardBody>
  )
}
