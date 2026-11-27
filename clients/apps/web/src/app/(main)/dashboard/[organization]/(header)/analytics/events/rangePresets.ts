import { DateRangeInterval } from '@/components/Metrics/DateRangePicker'
import { subDays, subHours, subMinutes } from 'date-fns'

export const DEFAULT_RANGE = 'last30Minutes'

export const recentRangeIntervals = (now: Date): DateRangeInterval[] => [
  {
    slug: 'last30Minutes',
    label: 'Last 30 minutes',
    value: [subMinutes(now, 30), now],
  },
  { slug: 'lastHour', label: 'Last hour', value: [subHours(now, 1), now] },
  {
    slug: 'last12Hours',
    label: 'Last 12 hours',
    value: [subHours(now, 12), now],
  },
  { slug: 'lastDay', label: 'Last day', value: [subDays(now, 1), now] },
  { slug: 'last3Days', label: 'Last 3 days', value: [subDays(now, 3), now] },
]
