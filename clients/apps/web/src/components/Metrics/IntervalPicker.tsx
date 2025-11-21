import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { differenceInDays } from 'date-fns'
import { useMemo } from 'react'

const MAX_INTERVAL_DAYS: Record<schemas['TimeInterval'], number> = {
  hour: 7,
  day: 366,
  week: 365,
  month: 365 * 4,
  year: 365 * 10,
}

const MIN_INTERVAL_DAYS: Record<schemas['TimeInterval'], number> = {
  hour: 0,
  day: 0,
  week: 14,
  month: 60,
  year: 366,
}

export const getNextValidInterval = (
  currentInterval: schemas['TimeInterval'],
  startDate: Date,
  endDate: Date,
): schemas['TimeInterval'] => {
  const days = differenceInDays(endDate, startDate)

  // If current interval is still valid, keep it
  // Check both minimum and maximum constraints
  if (
    days >= MIN_INTERVAL_DAYS[currentInterval] &&
    days <= MAX_INTERVAL_DAYS[currentInterval]
  ) {
    return currentInterval
  }

  // Otherwise, find the next valid interval
  // Iterate from finest to coarsest granularity to find the first valid interval
  const intervals: schemas['TimeInterval'][] = [
    'year',
    'month',
    'week',
    'day',
    'hour',
  ]

  // If current interval is too wide for the range, pick the widest matching one
  // If it's too narrow, pick the narrowest matching one
  if (days > MAX_INTERVAL_DAYS[currentInterval]) {
    intervals.reverse()
  }

  return (
    intervals.find(
      (interval) =>
        days >= MIN_INTERVAL_DAYS[interval] &&
        days <= MAX_INTERVAL_DAYS[interval],
    ) || 'day'
  )
}

const getIntervalLabel = (interval: schemas['TimeInterval']) => {
  switch (interval) {
    case 'hour':
      return 'Hourly'
    case 'day':
      return 'Daily'
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'year':
      return 'Yearly'
  }
}

const IntervalPicker = ({
  interval,
  onChange,
  startDate,
  endDate,
}: {
  interval: schemas['TimeInterval']
  onChange: (interval: schemas['TimeInterval']) => void
  startDate?: Date
  endDate?: Date
}) => {
  const disabledIntervals = useMemo(() => {
    if (!startDate || !endDate) {
      return new Set<schemas['TimeInterval']>()
    }

    const days = differenceInDays(endDate, startDate)
    const disabled = new Set<schemas['TimeInterval']>()

    Object.entries(MAX_INTERVAL_DAYS).forEach(([intervalKey, maxDays]) => {
      const typedInterval = intervalKey as schemas['TimeInterval']
      const minDays = MIN_INTERVAL_DAYS[typedInterval]
      if (days > maxDays || days < minDays) {
        disabled.add(typedInterval)
      }
    })

    return disabled
  }, [startDate, endDate])

  return (
    <Select value={interval} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select an interval" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(enums.timeIntervalValues).map((interval) => (
          <SelectItem
            value={interval}
            key={interval}
            disabled={disabledIntervals.has(interval)}
          >
            {getIntervalLabel(interval)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default IntervalPicker
