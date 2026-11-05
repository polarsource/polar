import { DateRangeInterval } from '@/components/Metrics/DateRangePicker'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { differenceInDays, endOfDay, startOfDay, subDays } from 'date-fns'

export type CostGroupBy = 'type' | 'customer' | 'model' | 'vendor'

export const COST_GROUP_BY: { value: CostGroupBy; label: string }[] = [
  { value: 'type', label: 'Event type' },
  { value: 'customer', label: 'Customer' },
  { value: 'model', label: 'Model' },
  { value: 'vendor', label: 'Vendor' },
]

export const DEFAULT_COST_RANGE = 'last30Days'

export interface CostRange {
  from: Date
  to: Date
}

const lastDays = (now: Date, days: number): [Date, Date] => [
  startOfDay(subDays(now, days - 1)),
  endOfDay(now),
]

export const costRangeIntervals = (now: Date): DateRangeInterval[] => [
  { slug: 'last7Days', label: 'Last 7 days', value: lastDays(now, 7) },
  { slug: 'last30Days', label: 'Last 30 days', value: lastDays(now, 30) },
  { slug: 'last90Days', label: 'Last 90 days', value: lastDays(now, 90) },
]

// Cost statistics are aggregated per day, so ranges snap to whole days.
export const toDayRange = ({ from, to }: CostRange): CostRange => ({
  from: startOfDay(from),
  to: endOfDay(new Date(to.getTime() - 1)),
})

export const pickCostInterval = ({
  from,
  to,
}: CostRange): schemas['TimeInterval'] => {
  const days = differenceInDays(to, from)
  if (days < 2) return 'hour'
  if (days <= 120) return 'day'
  if (days <= 365) return 'week'
  return 'month'
}

export const previousCostRange = ({ from, to }: CostRange): CostRange => {
  const days = differenceInDays(to, from) + 1
  return { from: subDays(from, days), to: subDays(to, days) }
}

export const toStatsDates = ({ from, to }: CostRange) => ({
  start_date: toISODate(from),
  end_date: toISODate(to),
})

export const parseCost = (values?: Record<string, string | number>) =>
  Number(values?.['_cost_amount'] ?? 0)
