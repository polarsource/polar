import { ParsedMetricPeriod } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { format, parse } from 'date-fns'

export const toISODate = (date: Date) => format(date, 'yyyy-MM-dd')

export const fromISODate = (date: string) =>
  parse(date, 'yyyy-MM-dd', new Date('1970-01-01T12:00:00Z'))

export const getValueFormatter = (
  metric: schemas['Metric'],
): ((value: number) => string) => {
  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    notation: 'compact',
  })
  switch (metric.type) {
    case 'currency':
      return (value: number) =>
        formatCurrencyAndAmount(value, 'usd', 0, 'compact')
    case 'scalar':
      return (value: number) => numberFormat.format(value)
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

export type MetricData =
  | ParsedMetricPeriod[]
  | {
      timestamp: Date
      quantity: number
    }[]

export const metricDisplayNames: Record<keyof schemas['Metrics'], string> = {
  revenue: 'Revenue',
  orders: 'Orders',
  cumulative_revenue: 'Cumulative Revenue',
  average_order_value: 'Average Order Value',
  one_time_products: 'One-Time Products',
  one_time_products_revenue: 'One-Time Products Revenue',
  new_subscriptions: 'New Subscriptions',
  new_subscriptions_revenue: 'New Subscriptions Revenue',
  renewed_subscriptions: 'Renewed Subscriptions',
  renewed_subscriptions_revenue: 'Renewed Subscriptions Revenue',
  active_subscriptions: 'Active Subscriptions',
  monthly_recurring_revenue: 'Monthly Recurring Revenue',
}

export const metricToCumulativeType: Record<
  schemas['Metric']['slug'],
  MetricCumulativeType
> = {
  revenue: 'sum',
  orders: 'sum',
  cumulative_revenue: 'lastValue',
  average_order_value: 'average',
  one_time_products: 'sum',
  one_time_products_revenue: 'sum',
  new_subscriptions: 'sum',
  new_subscriptions_revenue: 'sum',
  renewed_subscriptions: 'sum',
  renewed_subscriptions_revenue: 'sum',
  active_subscriptions: 'lastValue',
  monthly_recurring_revenue: 'lastValue',
  quantity: 'sum',
}

export type MetricCumulativeType = 'sum' | 'average' | 'lastValue'

export const computeCumulativeValue = (
  metric: schemas['Metric'],
  values: number[],
): number => {
  if (values.length === 0) return 0

  const cumulativeType = metricToCumulativeType[metric.slug]

  switch (cumulativeType) {
    case 'sum':
      return values.reduce((acc, value) => acc + value, 0)
    case 'average':
      const nonZeroValues = values.filter((value) => value !== 0)
      return (
        nonZeroValues.reduce((acc, value) => acc + value, 0) /
        (nonZeroValues.length || 1)
      )
    case 'lastValue':
      return values[values.length - 1]
    default:
      return 0
  }
}

export const dateToInterval = (startDate: Date) => {
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
