import { schemas } from '@polar-sh/client'
import { TimeRange } from '@/components/Events/EventsHistogramControls'
import {
  DateRangeInterval,
  dateRangeIntervals,
} from '@/components/Metrics/DateRangePicker'
import { differenceInDays, format, startOfDay, subDays } from 'date-fns'
import { parseAsIsoDateTime, parseAsString, useQueryStates } from 'nuqs'
import { useState } from 'react'

const DEFAULT_RANGE = 'last30Days'

export const recentIntervals = (now: Date): DateRangeInterval[] => [
  {
    slug: 'last7Days',
    label: 'Last 7 days',
    value: [startOfDay(subDays(now, 6)), now],
  },
  {
    slug: 'last30Days',
    label: 'Last 30 days',
    value: [startOfDay(subDays(now, 29)), now],
  },
  {
    slug: 'last90Days',
    label: 'Last 90 days',
    value: [startOfDay(subDays(now, 89)), now],
  },
]

// Fine enough for the chart to group into its bars over any range.
const intervalFor = (from: Date, to: Date) =>
  differenceInDays(to, from) <= 7 ? ('hour' as const) : ('day' as const)

// Period ends are exclusive instants; the API takes inclusive dates.
const toPeriod = ({ from, to }: TimeRange) => ({
  start_date: format(from, 'yyyy-MM-dd'),
  end_date: format(new Date(to.getTime() - 1), 'yyyy-MM-dd'),
})

// The same URL parameters as the event explorer, so links between the two
// keep the range and the brushed selection.
export const useFeatureRange = (organization: schemas['Organization']) => {
  const [now, setNow] = useState(() => new Date())
  const [state, setState] = useQueryStates({
    range: parseAsString,
    startDate: parseAsIsoDateTime,
    endDate: parseAsIsoDateTime,
    selectionStart: parseAsIsoDateTime,
    selectionEnd: parseAsIsoDateTime,
  })
  const intervals = recentIntervals(now)
  const isCustom = state.startDate !== null && state.endDate !== null
  const selectedRange = isCustom ? null : (state.range ?? DEFAULT_RANGE)
  const preset =
    [...intervals, ...dateRangeIntervals(organization)].find(
      (interval) => interval.slug === selectedRange,
    ) ?? intervals[1]
  const dateRange: TimeRange =
    state.startDate !== null && state.endDate !== null
      ? { from: state.startDate, to: state.endDate }
      : { from: preset.value[0], to: preset.value[1] }
  const selection: TimeRange | null =
    state.selectionStart !== null && state.selectionEnd !== null
      ? { from: state.selectionStart, to: state.selectionEnd }
      : null

  return {
    intervals,
    dateRange,
    selectedRange,
    selection,
    // The whole range, for the chart and the rail.
    rangePeriod: toPeriod(dateRange),
    // What the tables and totals cover: the selection when there is one.
    period: toPeriod(selection ?? dateRange),
    interval: intervalFor(dateRange.from, dateRange.to),
    earliest: startOfDay(new Date(organization.created_at)),
    latest: now,
    setDateRange: (range: TimeRange, interval?: DateRangeInterval) => {
      setNow(new Date())
      setState(
        interval
          ? {
              range: interval.slug === DEFAULT_RANGE ? null : interval.slug,
              startDate: null,
              endDate: null,
              selectionStart: null,
              selectionEnd: null,
            }
          : {
              range: null,
              startDate: range.from,
              endDate: range.to,
              selectionStart: null,
              selectionEnd: null,
            },
      )
    },
    setSelection: (next: TimeRange | null) =>
      setState({
        selectionStart: next?.from ?? null,
        selectionEnd: next?.to ?? null,
      }),
    zoom: (range: TimeRange, next: TimeRange | null) =>
      setState({
        range: null,
        startDate: range.from,
        endDate: range.to,
        selectionStart: next?.from ?? null,
        selectionEnd: next?.to ?? null,
      }),
  }
}
