import { schemas } from '@polar-sh/client'

export const METRIC_TYPES = [
  'subscriptions',
  'cancellations',
  'one-time',
  'orders',
  'checkouts',
  'net-revenue',
  'costs',
] as const

export type MetricType = (typeof METRIC_TYPES)[number]

export function isValidMetricType(value: string): value is MetricType {
  return METRIC_TYPES.includes(value as MetricType)
}

export const SUBSCRIPTION_METRICS: (keyof schemas['Metrics'])[] = [
  'monthly_recurring_revenue',
  'committed_monthly_recurring_revenue',
  'active_subscriptions',
  'new_subscriptions',
  'committed_subscriptions',
  'renewed_subscriptions',
  'average_revenue_per_user',
  'ltv',
  'new_subscriptions_revenue',
  'renewed_subscriptions_revenue',
]

export const CANCELLATION_CHART_METRICS: (keyof schemas['Metrics'])[] = [
  'canceled_subscriptions',
  'churned_subscriptions',
  'churn_rate',
  'active_subscriptions',
  'committed_subscriptions',
]

export const CANCELLATION_METRICS: (keyof schemas['Metrics'])[] = [
  ...CANCELLATION_CHART_METRICS,
  'canceled_subscriptions_too_expensive',
  'canceled_subscriptions_missing_features',
  'canceled_subscriptions_switched_service',
  'canceled_subscriptions_unused',
  'canceled_subscriptions_customer_service',
  'canceled_subscriptions_low_quality',
  'canceled_subscriptions_too_complex',
  'canceled_subscriptions_other',
]

export const ONE_TIME_METRICS: (keyof schemas['Metrics'])[] = [
  'one_time_products',
  'one_time_products_revenue',
]

export const ORDER_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
  'cumulative_revenue',
]

export const CHECKOUT_METRICS: (keyof schemas['Metrics'])[] = [
  'checkouts_conversion',
  'checkouts',
  'succeeded_checkouts',
]

export const NET_REVENUE_BASE_METRICS: (keyof schemas['Metrics'])[] = [
  'net_revenue',
  'net_average_order_value',
  'net_cumulative_revenue',
]

export const NET_REVENUE_SUBSCRIPTION_METRICS: (keyof schemas['Metrics'])[] = [
  'new_subscriptions_net_revenue',
  'renewed_subscriptions_net_revenue',
]

export const NET_REVENUE_ONE_TIME_METRICS: (keyof schemas['Metrics'])[] = [
  'one_time_products_net_revenue',
]

export const COST_METRICS: (keyof schemas['Metrics'])[] = [
  'costs',
  'cost_per_user',
  'gross_margin',
  'gross_margin_percentage',
  'cashflow',
]

export function getMetricsForType(
  metricType: MetricType,
  options?: {
    hasRecurringProducts?: boolean
    hasOneTimeProducts?: boolean
  },
): (keyof schemas['Metrics'])[] {
  switch (metricType) {
    case 'subscriptions':
      return SUBSCRIPTION_METRICS
    case 'cancellations':
      return CANCELLATION_METRICS
    case 'one-time':
      return ONE_TIME_METRICS
    case 'orders':
      return ORDER_METRICS
    case 'checkouts':
      return CHECKOUT_METRICS
    case 'net-revenue':
      return [
        ...NET_REVENUE_BASE_METRICS,
        ...(options?.hasRecurringProducts
          ? NET_REVENUE_SUBSCRIPTION_METRICS
          : []),
        ...(options?.hasOneTimeProducts ? NET_REVENUE_ONE_TIME_METRICS : []),
      ]
    case 'costs':
      return COST_METRICS
  }
}
