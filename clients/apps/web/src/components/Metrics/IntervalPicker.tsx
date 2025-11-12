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

export const getNextValidInterval = (
  currentInterval: schemas['TimeInterval'],
  startDate: Date,
  endDate: Date,
): schemas['TimeInterval'] => {
  const days = differenceInDays(endDate, startDate)

  // If current interval is still valid, keep it
  // Backend checks: end_date.toordinal() - start_date.toordinal() <= MAX_INTERVAL_DAYS
  // differenceInDays gives us the same ordinal difference
  if (days <= MAX_INTERVAL_DAYS[currentInterval]) {
    return currentInterval
  }

  // Otherwise, find the next valid interval (going up in granularity)
  const intervalOrder: schemas['TimeInterval'][] = [
    'hour',
    'day',
    'week',
    'month',
    'year',
  ]

  for (const interval of intervalOrder) {
    if (days <= MAX_INTERVAL_DAYS[interval]) {
      return interval
    }
  }

  return 'year'
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
      if (days > maxDays) {
        disabled.add(intervalKey as schemas['TimeInterval'])
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
