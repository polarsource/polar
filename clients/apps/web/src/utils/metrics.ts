import { getMetricsRangeDates, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  parse,
} from 'date-fns'
import { formatPercentage, formatScalar } from './formatters'

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

export const getFormattedMetricValue = (
  metric: schemas['Metric'],
  value: number,
): string => {
  switch (metric.type) {
    case 'scalar':
      return formatScalar(value)
    case 'currency':
      return formatCurrency('statistics')(value, 'usd')
    case 'percentage':
      return formatPercentage(value)
    case 'currency_sub_cent':
      return formatCurrency('subcent')(value, 'usd')
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
  const [startDate, endDate] = getMetricsRangeDates(range, {
    createdAt,
  })
  const interval = dateRangeToInterval(startDate, endDate)
  return [startDate, endDate, interval]
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

export const DEFAULT_OVERVIEW_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'monthly_recurring_revenue',
  'active_subscriptions',
  'orders',
  'checkouts_conversion',
]

type MetricEntry = {
  slug: keyof schemas['Metrics']
  display_name: string
  description: string
}

export type MetricGroup = {
  category: string
  metrics: MetricEntry[]
}

export const METRIC_GROUPS: MetricGroup[] = [
  {
    category: 'Revenue',
    metrics: [
      {
        slug: 'revenue',
        display_name: 'Revenue',
        description: 'Gross revenue from all completed orders in the period.',
      },
      {
        slug: 'net_revenue',
        display_name: 'Net Revenue',
        description:
          'Revenue after deducting Polar fees and payment processing costs.',
      },
      {
        slug: 'cumulative_revenue',
        display_name: 'Cumulative Revenue',
        description: 'Running total of gross revenue over the selected period.',
      },
      {
        slug: 'net_cumulative_revenue',
        display_name: 'Net Cumulative Revenue',
        description: 'Running total of net revenue over the selected period.',
      },
      {
        slug: 'average_order_value',
        display_name: 'Average Order Value',
        description: 'Mean gross value per completed order.',
      },
      {
        slug: 'net_average_order_value',
        display_name: 'Net Average Order Value',
        description: 'Mean net value per completed order after fees.',
      },
    ],
  },
  {
    category: 'Orders',
    metrics: [
      {
        slug: 'orders',
        display_name: 'Orders',
        description:
          'Total number of completed orders, including one-time and subscription charges.',
      },
      {
        slug: 'one_time_products',
        display_name: 'One-Time Products',
        description: 'Number of one-time product purchases completed.',
      },
      {
        slug: 'one_time_products_revenue',
        display_name: 'One-Time Products Revenue',
        description: 'Gross revenue from one-time product sales.',
      },
      {
        slug: 'one_time_products_net_revenue',
        display_name: 'One-Time Products Net Revenue',
        description: 'Net revenue from one-time product sales after fees.',
      },
    ],
  },
  {
    category: 'Subscriptions',
    metrics: [
      {
        slug: 'new_subscriptions',
        display_name: 'New Subscriptions',
        description: 'Number of new subscriptions started in the period.',
      },
      {
        slug: 'new_subscriptions_revenue',
        display_name: 'New Subscriptions Revenue',
        description: 'Gross revenue from first charges on new subscriptions.',
      },
      {
        slug: 'new_subscriptions_net_revenue',
        display_name: 'New Subscriptions Net Revenue',
        description:
          'Net revenue from first charges on new subscriptions after fees.',
      },
      {
        slug: 'renewed_subscriptions',
        display_name: 'Renewed Subscriptions',
        description: 'Number of existing subscriptions successfully renewed.',
      },
      {
        slug: 'renewed_subscriptions_revenue',
        display_name: 'Renewed Subscriptions Revenue',
        description: 'Gross revenue from subscription renewal charges.',
      },
      {
        slug: 'renewed_subscriptions_net_revenue',
        display_name: 'Renewed Subscriptions Net Revenue',
        description:
          'Net revenue from subscription renewal charges after fees.',
      },
      {
        slug: 'active_subscriptions',
        display_name: 'Active Subscriptions',
        description:
          'Current count of subscriptions that are active and not canceled.',
      },
      {
        slug: 'committed_subscriptions',
        display_name: 'Committed Subscriptions',
        description:
          'Active subscriptions still within a committed billing period.',
      },
      {
        slug: 'monthly_recurring_revenue',
        display_name: 'Monthly Recurring Revenue',
        description:
          'Normalized monthly revenue from all active subscriptions.',
      },
      {
        slug: 'committed_monthly_recurring_revenue',
        display_name: 'Committed MRR',
        description:
          'MRR from subscriptions still within a committed billing period.',
      },
    ],
  },
  {
    category: 'Checkouts',
    metrics: [
      {
        slug: 'checkouts',
        display_name: 'Checkouts',
        description:
          'Total number of checkout sessions initiated by customers.',
      },
      {
        slug: 'succeeded_checkouts',
        display_name: 'Succeeded Checkouts',
        description: 'Checkout sessions that resulted in a completed order.',
      },
      {
        slug: 'checkouts_conversion',
        display_name: 'Checkouts Conversion',
        description:
          'Percentage of initiated checkouts that completed successfully.',
      },
    ],
  },
  {
    category: 'Cancellations',
    metrics: [
      {
        slug: 'canceled_subscriptions',
        display_name: 'Canceled Subscriptions',
        description: 'Total subscriptions canceled during the period.',
      },
      {
        slug: 'canceled_subscriptions_customer_service',
        display_name: 'Canceled - Customer Service',
        description:
          'Subscriptions canceled citing customer service as the reason.',
      },
      {
        slug: 'canceled_subscriptions_low_quality',
        display_name: 'Canceled - Low Quality',
        description: 'Subscriptions canceled due to perceived low quality.',
      },
      {
        slug: 'canceled_subscriptions_missing_features',
        display_name: 'Canceled - Missing Features',
        description:
          'Subscriptions canceled because required features were missing.',
      },
      {
        slug: 'canceled_subscriptions_switched_service',
        display_name: 'Canceled - Switched Service',
        description:
          'Subscriptions canceled because customers moved to a competing service.',
      },
      {
        slug: 'canceled_subscriptions_too_complex',
        display_name: 'Canceled - Too Complex',
        description:
          'Subscriptions canceled because the product was too difficult to use.',
      },
      {
        slug: 'canceled_subscriptions_too_expensive',
        display_name: 'Canceled - Too Expensive',
        description:
          'Subscriptions canceled because customers found the price too high.',
      },
      {
        slug: 'canceled_subscriptions_unused',
        display_name: 'Canceled - Unused',
        description:
          'Subscriptions canceled because customers were not using the product.',
      },
      {
        slug: 'canceled_subscriptions_other',
        display_name: 'Canceled - Other',
        description:
          'Subscriptions canceled for reasons not covered by other categories.',
      },
      {
        slug: 'churned_subscriptions',
        display_name: 'Churned Subscriptions',
        description:
          'Subscriptions lost to non-renewal at the end of a billing period.',
      },
    ],
  },
  {
    category: 'Unit Economics',
    metrics: [
      {
        slug: 'average_revenue_per_user',
        display_name: 'Average Revenue Per User',
        description: 'Mean revenue generated per active subscriber.',
      },
      {
        slug: 'churn_rate',
        display_name: 'Churn Rate',
        description: 'Percentage of active subscriptions lost in the period.',
      },
      {
        slug: 'ltv',
        display_name: 'Lifetime Value',
        description:
          'Estimated total revenue from a customer over their lifetime.',
      },
    ],
  },
  {
    category: 'Costs',
    metrics: [
      {
        slug: 'costs',
        display_name: 'Costs',
        description:
          'Total platform costs including Polar fees and payment processing.',
      },
      {
        slug: 'cumulative_costs',
        display_name: 'Cumulative Costs',
        description: 'Running total of costs over the selected period.',
      },
      {
        slug: 'cost_per_user',
        display_name: 'Cost Per User',
        description: 'Average cost attributable per active subscriber.',
      },
      {
        slug: 'gross_margin',
        display_name: 'Gross Margin',
        description: 'Net revenue minus total costs.',
      },
      {
        slug: 'gross_margin_percentage',
        display_name: 'Gross Margin %',
        description: 'Gross margin expressed as a percentage of net revenue.',
      },
      {
        slug: 'cashflow',
        display_name: 'Cashflow',
        description: 'Net revenue minus costs for the period.',
      },
    ],
  },
  {
    category: 'Usage',
    metrics: [
      {
        slug: 'active_user_by_event',
        display_name: 'Active Users by Event',
        description: 'Number of unique users tracked via usage events.',
      },
    ],
  },
]

export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.metrics)
