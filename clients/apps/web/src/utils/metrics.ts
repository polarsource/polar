import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
  startOfYesterday,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'

export const toISODate = (date: Date) => format(date, 'yyyy-MM-dd')

export const fromISODate = (date: string) =>
  parse(date, 'yyyy-MM-dd', new Date('1970-01-01T12:00:00Z'))

const scalarTickFormatter = Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

const percentageTickFormatter = Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export const getTickFormatter = (
  metric: schemas['Metric'],
): ((value: number) => string) => {
  switch (metric.type) {
    case 'scalar':
      return scalarTickFormatter.format
    case 'currency':
      return (value: number) =>
        formatCurrencyAndAmount(value, 'usd', 0, 'compact')
    case 'percentage':
      return percentageTickFormatter.format
  }
}

const scalarFormatter = Intl.NumberFormat('en-US', {})
const percentageFormatter = Intl.NumberFormat('en-US', {
  style: 'percent',
})

export const getFormattedMetricValue = (
  metric: schemas['Metric'],
  value: number,
): string => {
  switch (metric.type) {
    case 'scalar':
      return scalarFormatter.format(value)
    case 'currency':
      return formatCurrencyAndAmount(value, 'usd', 0)
    case 'percentage':
      return percentageFormatter.format(value)
  }
}

export const getTimestampFormatter = (
  interval: schemas['TimeInterval'],
  locale: string = 'en-US',
): ((value: Date) => string) => {
  switch (interval) {
    case 'hour':
      return (value: Date) =>
        value.toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
    case 'day':
    case 'week':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          dateStyle: 'medium',
        })
    case 'month':
      return (value: Date) => format(value, 'MMMM yyyy')
    case 'year':
      return (value: Date) => format(value, 'yyyy')
  }
}

export const getTicks = (timestamps: Date[], maxTicks: number = 10): Date[] => {
  const step = Math.ceil(timestamps.length / maxTicks)
  return timestamps.filter((_, index) => index % step === 0)
}

export const dateRangeToInterval = (startDate: Date, endDate: Date) => {
  const diffInYears = differenceInYears(endDate, startDate)
  const diffInMonths = differenceInMonths(endDate, startDate)
  const diffInWeeks = differenceInWeeks(endDate, startDate)
  const diffInDays = differenceInDays(endDate, startDate)

  if (diffInYears >= 3) {
    return 'year'
  } else if (diffInMonths >= 4) {
    return 'month'
  } else if (diffInWeeks > 4) {
    return 'week'
  } else if (diffInDays > 1) {
    return 'day'
  } else {
    return 'hour'
  }
}

export type ChartRange = 'all_time' | '12m' | '3m' | '30d' | 'today'

export const CHART_RANGES: Record<ChartRange, string> = {
  all_time: 'All Time',
  '12m': '12m',
  '3m': '3m',
  '30d': '30d',
  today: 'Today',
}

export const getChartRangeParams = (
  range: ChartRange,
  createdAt: string | Date,
): [Date, Date, schemas['TimeInterval']] => {
  const endDate = new Date()
  const parsedCreatedAt = new Date(createdAt)
  const _getStartDate = (range: ChartRange) => {
    const now = new Date()
    switch (range) {
      case 'all_time':
        return parsedCreatedAt
      case '12m':
        return subYears(now, 1)
      case '3m':
        return subMonths(now, 3)
      case '30d':
        return startOfDay(subDays(now, 30))
      case 'today':
        return startOfDay(now)
    }
  }
  const startDate = _getStartDate(range)
  const interval = dateRangeToInterval(startDate, endDate)
  return [startDate, endDate, interval]
}

export const getPreviousParams = (
  startDate: Date,
  range: ChartRange,
): [Date, Date] | null => {
  switch (range) {
    case 'all_time':
      return null
    case '12m':
      return [startOfYear(subYears(startDate, 1)), startDate]
    case '3m':
      return [startOfMonth(subMonths(startDate, 3)), startDate]
    case '30d':
      return [startOfDay(subMonths(startDate, 1)), startDate]
    case 'today':
      return [startOfYesterday(), startDate]
  }
}
