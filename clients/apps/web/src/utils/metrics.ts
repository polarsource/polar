import { schemas } from '@polar-sh/client'
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
  startOfYesterday,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import {
  formatAccountingFriendlyCurrency,
  formatHumanFriendlyCurrency,
  formatHumanFriendlyScalar,
  formatPercentage,
  formatScalar,
  formatSubCentCurrency,
} from './formatters'

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD) in local timezone.
 * Adjusts for timezone offset to ensure the local date is preserved.
 */
export const toISODate = (date: Date) => {
  // Offset the date by the timezone offset so that when converted to UTC,
  // we get the correct local date values
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().split('T')[0]
}

/**
 * Parses an ISO date string (YYYY-MM-DD) to a Date object at midnight local time.
 * Uses a local reference date to avoid timezone issues.
 */
export const fromISODate = (date: string) =>
  parse(date, 'yyyy-MM-dd', new Date(1970, 0, 1, 0, 0, 0))

export const getTickFormatter = (
  metric: schemas['Metric'],
): ((value: number) => string) => {
  switch (metric.type) {
    case 'scalar':
      return formatHumanFriendlyScalar
    case 'currency':
      return (value: number) => formatHumanFriendlyCurrency(value, 'usd')
    case 'percentage':
      return formatPercentage
    case 'currency_sub_cent':
      return (value: number) => formatSubCentCurrency(value, 'usd')
  }
}

export const getFormattedMetricValue = (
  metric: schemas['Metric'],
  value: number,
): string => {
  switch (metric.type) {
    case 'scalar':
      return formatScalar(value)
    case 'currency':
      return formatAccountingFriendlyCurrency(value, 'usd')
    case 'percentage':
      return formatPercentage(value)
    case 'currency_sub_cent':
      return formatSubCentCurrency(value, 'usd')
  }
}

export const getTimestampFormatter = (
  interval: schemas['TimeInterval'],
  locale: string = 'en-US',
): ((value: Date) => string) => {
  switch (interval) {
    case 'hour':
      return (value: Date) =>
        value.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
    case 'day':
    case 'week':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          day: '2-digit',
        })
    case 'month':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          year: 'numeric',
        })
    case 'year':
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          year: 'numeric',
        })
    default:
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          month: 'short',
          day: '2-digit',
        })
  }
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

export const getPreviousDateRange = (
  startDate: Date,
  endDate: Date,
): [Date, Date] => {
  const delta = endDate.getTime() - startDate.getTime()
  const previousEndDate = new Date(startDate.getTime())
  const previousStartDate = new Date(startDate.getTime() - delta)
  return [previousStartDate, previousEndDate]
}
