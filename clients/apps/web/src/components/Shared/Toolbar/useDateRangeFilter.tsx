import {
  dateRangeIntervals,
  dateRangeToMatchingInterval,
  type DateRange,
} from '@/components/Metrics/DateRangePicker'
import { type Filter } from '@/components/Shared/FilterPopover'
import { schemas } from '@polar-sh/client'
import { CalendarDays } from '@polar-sh/orbit/icons'
import { Calendar } from '@polar-sh/ui/components/ui/calendar'
import { endOfDay, format, startOfDay } from 'date-fns'
import { useState } from 'react'

const CUSTOM = 'custom'
// No range at all covers the same time, so it is not offered as an option.
const ALL_TIME = 'allTime'

interface PickedRange {
  from: Date | undefined
  to?: Date
}

const formatDay = (date: Date) => format(date, 'MMM d, yyyy')

const RangeCalendar = ({
  range,
  minDate,
  onChange,
}: {
  range: DateRange | null
  minDate: Date
  onChange: (range: DateRange) => void
}) => {
  // The first day picked waits here until the second completes the range. A
  // pick always starts a new range, it never moves an end of the current one.
  const [start, setStart] = useState<Date | null>(null)
  const selected: PickedRange | undefined = start
    ? { from: start, to: undefined }
    : (range ?? undefined)
  return (
    <Calendar
      mode="range"
      defaultMonth={range?.to}
      selected={selected}
      disabled={{ before: minDate }}
      onSelect={(_picked, day) => {
        if (!start) {
          setStart(day)
          return
        }
        const [from, to] = start <= day ? [start, day] : [day, start]
        setStart(null)
        onChange({ from: startOfDay(from), to: endOfDay(to) })
      }}
    />
  )
}

// A span of days, picked from the usual periods or from a calendar. Without a
// range nothing is filtered.
export const useDateRangeFilter = (
  organization: schemas['Organization'],
  range: DateRange | null,
  onChange: (range: DateRange | null) => void,
  { key = 'date', label = 'Date' }: { key?: string; label?: string } = {},
): Filter => {
  const intervals = dateRangeIntervals(organization)
  const matching = range && dateRangeToMatchingInterval(range, organization)
  const isAllTime = range === null || matching?.slug === ALL_TIME

  return {
    key,
    label,
    icon: <CalendarDays className="size-4" />,
    type: 'single',
    options: intervals
      .filter(({ slug }) => slug !== ALL_TIME)
      .map(({ slug, label }) => ({ value: slug, label })),
    value: isAllTime ? null : (matching?.slug ?? CUSTOM),
    valueLabel:
      range && !matching
        ? `${formatDay(range.from)} to ${formatDay(range.to)}`
        : undefined,
    onChange: (slug) => {
      const interval = intervals.find((interval) => interval.slug === slug)
      onChange(
        interval ? { from: interval.value[0], to: interval.value[1] } : null,
      )
    },
    extra: (
      <RangeCalendar
        range={isAllTime ? null : range}
        minDate={startOfDay(new Date(organization.created_at))}
        onChange={onChange}
      />
    ),
  }
}
