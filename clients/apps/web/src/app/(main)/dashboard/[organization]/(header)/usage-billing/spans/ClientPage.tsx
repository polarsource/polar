'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { Sparkline, SparklineColor } from '@/components/Sparkline/Sparkline'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { parseSearchParams, serializeSearchParams } from '@/utils/datatable'
import { formatSubCentCurrency } from '@/utils/formatters'
import { operations, schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { endOfToday, subMonths } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseAsIsoDateTime, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

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

  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(subMonths(endOfToday(), 1)),
  )
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(endOfToday()),
  )
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
    startDate,
    endDate,
    interval,
    ['_cost.amount'],
    sortingParam,
  )

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      setInterval(newInterval)
    },
    [setInterval],
  )

  const [hasScrolled, setHasScrolled] = useState(false)

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
      title="Spans"
      wide
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <div>Spans</div>
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
                  {costData?.totals?.map((stat) => (
                    <ListItem
                      key={stat.name}
                      size="small"
                      className="justify-between px-3"
                      inactiveClassName="text-gray-500 dark:text-polar-500"
                      onSelect={() => {
                        const params = new URLSearchParams()
                        params.set('eventName', stat.name)
                        if (startDate) {
                          params.set('startDate', startDate.toISOString())
                        }
                        if (endDate) {
                          params.set('endDate', endDate.toISOString())
                        }
                        params.set('interval', interval)
                        router.push(
                          `/dashboard/${organization.slug}/usage-billing/spans/foo?${params}`,
                        )
                      }}
                    >
                      <span className="truncate">{stat.name}</span>
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
      <div className="flex flex-col gap-y-6">
        <h3 className="text-2xl">Event Costs</h3>
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
              `/dashboard/${organization.slug}/usage-billing/spans?${sortingParams}`,
            )
          }}
          onRowClick={(row) => {
            const params = new URLSearchParams()
            params.set('eventName', row.original.name)
            if (startDate) {
              params.set('startDate', startDate.toISOString())
            }
            if (endDate) {
              params.set('endDate', endDate.toISOString())
            }
            params.set('interval', interval)
            router.push(
              `/dashboard/${organization.slug}/usage-billing/spans/foo?${params}`,
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
                  <span className="font-medium">{row.original.name}</span>
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
                    <div className="flex items-center gap-3">
                      <span className="min-w-20">
                        {formatSubCentCurrency(
                          Number(row.original.averages?.['_cost_amount'] || 0),
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          color={SparklineColor.Green}
                          width={80}
                          height={24}
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
                    <div className="flex items-center gap-3">
                      <span className="min-w-20">
                        {formatSubCentCurrency(
                          Number(row.original.p95?.['_cost_amount'] || 0),
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          color={SparklineColor.Green}
                          width={80}
                          height={24}
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
                    <div className="flex items-center gap-3">
                      <span className="min-w-20">
                        {formatSubCentCurrency(
                          Number(row.original.p99?.['_cost_amount'] || 0),
                        )}
                      </span>
                      {values.length > 0 && (
                        <Sparkline
                          values={values}
                          color={SparklineColor.Red}
                          width={80}
                          height={24}
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
