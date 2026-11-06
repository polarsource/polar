'use client'

import {
  CostBreakdownHeader,
  CostBreakdownRow,
} from '@/components/Costs/CostBreakdownTable'
import {
  CostDetailView,
  rowSelection,
  useCostSelection,
} from '@/components/Costs/CostDetailView'
import {
  COST_GROUP_BY,
  CostGroupBy,
  costRangeIntervals,
  DEFAULT_COST_RANGE,
  toDayRange,
} from '@/components/Costs/costRanges'
import {
  parseAsDayEnd,
  parseAsDayStart,
} from '@/components/Costs/costQueryParsers'
import { CostsHistogram } from '@/components/Costs/CostsHistogram'
import {
  COST_SORTS,
  DEFAULT_COST_SORT,
  isCostSortable,
  parseCostSort,
} from '@/components/Costs/costSorting'
import { CostsSidebar } from '@/components/Costs/CostsSidebar'
import { useCostBreakdown } from '@/components/Costs/useCostBreakdown'
import { TimeRange } from '@/components/Events/EventsHistogramControls'
import { EventLogSkeleton } from '@/components/Events/EventLogSkeleton'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  DateRangeInterval,
  dateRangeIntervals,
} from '@/components/Metrics/DateRangePicker'
import { EmptyState } from '@/components/Shared/EmptyState'
import { formatCostAmount } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChartNoAxesColumn } from '@polar-sh/orbit/icons'
import { endOfToday, startOfDay } from 'date-fns'
import {
  parseAsArrayOf,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useState } from 'react'

const PUSH_HISTORY = { history: 'push' } as const

const GROUP_BY_VALUES = COST_GROUP_BY.map((option) => option.value)

export default function CostsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [range, setRange] = useQueryState(
    'range',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const [customStart, setCustomStart] = useQueryState(
    'startDate',
    parseAsDayStart.withOptions(PUSH_HISTORY),
  )
  const [customEnd, setCustomEnd] = useQueryState(
    'endDate',
    parseAsDayEnd.withOptions(PUSH_HISTORY),
  )
  const [selectionStart, setSelectionStart] = useQueryState(
    'selectionStart',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const [selectionEnd, setSelectionEnd] = useQueryState(
    'selectionEnd',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const [groupBy, setGroupBy] = useQueryState(
    'groupBy',
    parseAsStringLiteral(GROUP_BY_VALUES)
      .withDefault('type')
      .withOptions(PUSH_HISTORY),
  )
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(COST_SORTS)
      .withDefault(DEFAULT_COST_SORT)
      .withOptions({ history: 'replace' }),
  )
  const [customerIds, setCustomerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString).withOptions(PUSH_HISTORY),
  )
  const { selected, select } = useCostSelection()

  const [rangeAnchor, setRangeAnchor] = useState(() => new Date())
  const rangeIntervals = costRangeIntervals(rangeAnchor)
  const allIntervals = [...rangeIntervals, ...dateRangeIntervals(organization)]
  const isCustomRange = customStart !== null && customEnd !== null
  const selectedRange = isCustomRange ? null : (range ?? DEFAULT_COST_RANGE)
  const preset =
    allIntervals.find((interval) => interval.slug === selectedRange) ??
    rangeIntervals[1]
  const dateRange = toDayRange(
    isCustomRange
      ? { from: customStart, to: customEnd }
      : { from: preset.value[0], to: preset.value[1] },
  )
  const selection =
    selectionStart !== null && selectionEnd !== null
      ? { from: selectionStart, to: selectionEnd }
      : null
  const activeRange = selection ? toDayRange(selection) : dateRange

  const setSelection = (next: TimeRange | null) => {
    setSelectionStart(next?.from ?? null)
    setSelectionEnd(next?.to ?? null)
  }

  const onDateRangeChange = (
    next: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => {
    setSelection(null)
    if (interval) {
      setRange(interval.slug === DEFAULT_COST_RANGE ? null : interval.slug)
      setCustomStart(null)
      setCustomEnd(null)
      setRangeAnchor(new Date())
      return
    }
    setRange(null)
    setCustomStart(next.from)
    setCustomEnd(next.to)
  }

  const onZoom = (next: TimeRange, nextSelection: TimeRange | null) => {
    setRange(null)
    setCustomStart(next.from)
    setCustomEnd(next.to)
    setSelection(nextSelection)
  }

  const hasActiveFilters =
    groupBy !== 'type' ||
    [range, customStart, customEnd, selectionStart, customerIds].some(
      (value) => value !== null,
    )

  const resetFilters = () => {
    setRange(null)
    setCustomStart(null)
    setCustomEnd(null)
    setSelection(null)
    setGroupBy(null)
    setCustomerIds(null)
    setRangeAnchor(new Date())
  }

  // A sort the grouping can't do (customer names) falls back to the default.
  const activeSort = isCostSortable(groupBy, parseCostSort(sort).key)
    ? sort
    : DEFAULT_COST_SORT
  const breakdown = useCostBreakdown(
    organization.id,
    groupBy,
    activeRange,
    customerIds,
    activeSort,
  )
  const groupLabel =
    COST_GROUP_BY.find((option) => option.value === groupBy)?.label ?? ''
  const detailView = selected ? (
    <CostDetailView
      organization={organization}
      selected={selected}
      range={activeRange}
      customerIds={customerIds}
      rows={breakdown.rows}
      onSelect={select}
    />
  ) : undefined

  return (
    <DashboardBody
      title={
        <Box
          flexGrow={1}
          alignItems="baseline"
          justifyContent="between"
          gap="s"
        >
          <Text as="h1" variant="heading-xxs">
            Costs
          </Text>
          {!breakdown.isLoading && (
            <Text variant="heading-xxs" color="muted" tabularNums>
              {formatCostAmount(breakdown.total)}
            </Text>
          )}
        </Box>
      }
      wrapperClassName="gap-6 pt-4 md:pt-6"
      className="min-h-0 flex-1 md:pb-0"
      contextViewPlacement="left"
      contextViewTitle="Filters"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={
        <CostsSidebar
          organizationId={organization.id}
          organizationSlug={organization.slug}
          dateRange={dateRange}
          rangeIntervals={rangeIntervals}
          selectedRange={selectedRange}
          onDateRangeChange={onDateRangeChange}
          groupBy={groupBy}
          onGroupByChange={(value: CostGroupBy) => {
            setGroupBy(value === 'type' ? null : value)
          }}
          selectedCustomerIds={customerIds}
          onSelectCustomerIds={setCustomerIds}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      }
      detailView={detailView}
      wide
    >
      <Box flexDirection="column" gap="xl" flexGrow={1} minHeight={0}>
        <CostsHistogram
          organizationId={organization.id}
          range={dateRange}
          customerIds={customerIds}
          selection={selection}
          onSelectionChange={setSelection}
          onZoom={onZoom}
          earliest={startOfDay(new Date(organization.created_at))}
          latest={endOfToday()}
        />
        {!breakdown.isLoading && breakdown.rows.length === 0 ? (
          <EmptyState
            icon={<ChartNoAxesColumn />}
            title="No costs"
            description="No cost events were recorded in this period"
          />
        ) : (
          <Box flexDirection="column" flexGrow={1} minHeight={0}>
            <CostBreakdownHeader
              groupBy={groupBy}
              groupLabel={groupLabel}
              compact={!!detailView}
              sort={activeSort}
              onSortChange={(next) =>
                setSort(next === DEFAULT_COST_SORT ? null : next)
              }
            />
            <Box
              flexDirection="column"
              flexGrow={1}
              minHeight={0}
              overflowY={{ base: 'visible', md: 'auto' }}
              paddingBottom={{ md: 'xl' }}
            >
              {breakdown.isLoading ? (
                <EventLogSkeleton />
              ) : (
                breakdown.rows.map((row) => {
                  const target = rowSelection(row, groupBy)
                  return (
                    <CostBreakdownRow
                      key={row.key}
                      row={row}
                      compact={!!detailView}
                      selected={
                        !!target &&
                        target.kind === selected?.kind &&
                        target.value === selected.value
                      }
                      onSelect={
                        target
                          ? () => select(target.kind, target.value)
                          : undefined
                      }
                    />
                  )
                })
              )}
            </Box>
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}
