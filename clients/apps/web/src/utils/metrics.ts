import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { format, parse } from 'date-fns'

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
      return formatCurrencyAndAmount(value, 'usd')
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

const dateToInterval = (startDate: Date) => {
  const yearsAgo = new Date().getFullYear() - startDate.getFullYear()
  const monthsAgo =
    (new Date().getFullYear() - startDate.getFullYear()) * 12 +
    (new Date().getMonth() - startDate.getMonth())
  const weeksAgo = Math.floor(
    (new Date().getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  )
  const daysAgo = Math.floor(
    (new Date().getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (yearsAgo >= 3) {
    return 'year'
  } else if (monthsAgo >= 4) {
    return 'month'
  } else if (weeksAgo > 4) {
    return 'week'
  } else if (daysAgo > 1) {
    return 'day'
  } else {
    return 'hour'
  }
}

export type ChartRange = 'all_time' | '12m' | '3m' | '30d' | '24h'

export const CHART_RANGES: Record<ChartRange, string> = {
  all_time: 'All Time',
  '12m': '12m',
  '3m': '3m',
  '30d': '30d',
  '24h': '24h',
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
        return new Date(new Date().setFullYear(now.getFullYear() - 1))
      case '3m':
        return new Date(new Date().setMonth(now.getMonth() - 3))
      case '30d':
        return new Date(new Date().setDate(now.getDate() - 30))
      case '24h':
        return new Date(new Date().setHours(now.getHours() - 24))
    }
  }
  const startDate = _getStartDate(range)
  const maxStartDate = startDate > parsedCreatedAt ? startDate : parsedCreatedAt
  const interval = dateToInterval(maxStartDate)
  return [maxStartDate, endDate, interval]
}

export const getPreviousParams = (
  startDate: Date,
  range: ChartRange,
): [Date, Date] | null => {
  const startDateCopy = new Date(startDate)
  switch (range) {
    case 'all_time':
      return null
    case '12m':
      return [
        new Date(startDateCopy.setFullYear(startDateCopy.getFullYear() - 1)),
        startDate,
      ]
    case '3m':
      return [
        new Date(startDateCopy.setMonth(startDateCopy.getMonth() - 3)),
        startDate,
      ]
    case '30d':
      return [
        new Date(startDateCopy.setDate(startDateCopy.getDate() - 30)),
        startDate,
      ]
    case '24h':
      return [
        new Date(startDateCopy.setHours(startDateCopy.getHours() - 24)),
        startDate,
      ]
  }
}
