import { Interval, Metric, MetricType } from '@polar-sh/sdk'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import { formatCurrencyAndAmount } from './money'

export const toISODate = (date: Date) => format(date, 'yyyy-MM-dd')

export const fromISODate = (date: string) =>
  parse(date, 'yyyy-MM-dd', new Date('1970-01-01T12:00:00Z'))

export const getValueFormatter = (
  metric: Metric,
): ((value: number) => string) => {
  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  })
  switch (metric.type) {
    case MetricType.CURRENCY:
      return (value: number) => formatCurrencyAndAmount(value, 'usd', 0)
    case MetricType.SCALAR:
      return (value: number) => numberFormat.format(value)
  }
}

export const getTimestampFormatter = (
  interval: Interval,
  locale: string = 'en-US',
): ((value: Date) => string) => {
  switch (interval) {
    case Interval.HOUR:
      return (value: Date) =>
        value.toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
    case Interval.DAY:
    case Interval.WEEK:
      return (value: Date) =>
        value.toLocaleDateString(locale, {
          dateStyle: 'medium',
        })
    case Interval.MONTH:
      return (value: Date) => format(value, 'MMMM yyyy')
    case Interval.YEAR:
      return (value: Date) => format(value, 'yyyy')
  }
}
