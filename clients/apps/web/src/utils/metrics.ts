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

export const ALL_METRICS: {
  slug: keyof schemas['Metrics']
  display_name: string
}[] = [
  { slug: 'revenue', display_name: 'Revenue' },
  { slug: 'net_revenue', display_name: 'Net Revenue' },
  { slug: 'cumulative_revenue', display_name: 'Cumulative Revenue' },
  { slug: 'net_cumulative_revenue', display_name: 'Net Cumulative Revenue' },
  { slug: 'average_order_value', display_name: 'Average Order Value' },
  {
    slug: 'net_average_order_value',
    display_name: 'Net Average Order Value',
  },
  { slug: 'orders', display_name: 'Orders' },
  { slug: 'one_time_products', display_name: 'One-Time Products' },
  {
    slug: 'one_time_products_revenue',
    display_name: 'One-Time Products Revenue',
  },
  {
    slug: 'one_time_products_net_revenue',
    display_name: 'One-Time Products Net Revenue',
  },
  { slug: 'new_subscriptions', display_name: 'New Subscriptions' },
  {
    slug: 'new_subscriptions_revenue',
    display_name: 'New Subscriptions Revenue',
  },
  {
    slug: 'new_subscriptions_net_revenue',
    display_name: 'New Subscriptions Net Revenue',
  },
  { slug: 'renewed_subscriptions', display_name: 'Renewed Subscriptions' },
  {
    slug: 'renewed_subscriptions_revenue',
    display_name: 'Renewed Subscriptions Revenue',
  },
  {
    slug: 'renewed_subscriptions_net_revenue',
    display_name: 'Renewed Subscriptions Net Revenue',
  },
  { slug: 'active_subscriptions', display_name: 'Active Subscriptions' },
  { slug: 'committed_subscriptions', display_name: 'Committed Subscriptions' },
  {
    slug: 'monthly_recurring_revenue',
    display_name: 'Monthly Recurring Revenue',
  },
  {
    slug: 'committed_monthly_recurring_revenue',
    display_name: 'Committed MRR',
  },
  { slug: 'checkouts', display_name: 'Checkouts' },
  { slug: 'succeeded_checkouts', display_name: 'Succeeded Checkouts' },
  { slug: 'checkouts_conversion', display_name: 'Checkouts Conversion' },
  { slug: 'canceled_subscriptions', display_name: 'Canceled Subscriptions' },
  {
    slug: 'canceled_subscriptions_customer_service',
    display_name: 'Canceled - Customer Service',
  },
  {
    slug: 'canceled_subscriptions_low_quality',
    display_name: 'Canceled - Low Quality',
  },
  {
    slug: 'canceled_subscriptions_missing_features',
    display_name: 'Canceled - Missing Features',
  },
  {
    slug: 'canceled_subscriptions_switched_service',
    display_name: 'Canceled - Switched Service',
  },
  {
    slug: 'canceled_subscriptions_too_complex',
    display_name: 'Canceled - Too Complex',
  },
  {
    slug: 'canceled_subscriptions_too_expensive',
    display_name: 'Canceled - Too Expensive',
  },
  {
    slug: 'canceled_subscriptions_unused',
    display_name: 'Canceled - Unused',
  },
  { slug: 'canceled_subscriptions_other', display_name: 'Canceled - Other' },
  { slug: 'churned_subscriptions', display_name: 'Churned Subscriptions' },
  {
    slug: 'average_revenue_per_user',
    display_name: 'Average Revenue Per User',
  },
  { slug: 'churn_rate', display_name: 'Churn Rate' },
  { slug: 'ltv', display_name: 'Lifetime Value' },
  { slug: 'costs', display_name: 'Costs' },
  { slug: 'cumulative_costs', display_name: 'Cumulative Costs' },
  { slug: 'cost_per_user', display_name: 'Cost Per User' },
  { slug: 'active_user_by_event', display_name: 'Active Users by Event' },
  { slug: 'gross_margin', display_name: 'Gross Margin' },
  { slug: 'gross_margin_percentage', display_name: 'Gross Margin %' },
  { slug: 'cashflow', display_name: 'Cashflow' },
]
