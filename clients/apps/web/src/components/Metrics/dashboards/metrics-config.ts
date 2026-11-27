import { schemas } from '@polar-sh/client'

export const METRIC_TYPES = ['costs'] as const

export type MetricType = (typeof METRIC_TYPES)[number]

export const CANCELLATION_CHART_METRICS: (keyof schemas['Metrics'])[] = [
  'canceled_subscriptions',
  'churned_subscriptions',
  'churn_rate',
  'active_subscriptions',
  'committed_subscriptions',
]

const COST_METRICS: (keyof schemas['Metrics'])[] = [
  'costs',
  'cost_per_user',
  'gross_margin',
  'gross_margin_percentage',
  'cashflow',
]

export function getMetricsForType(
  metricType: MetricType,
): (keyof schemas['Metrics'])[] {
  switch (metricType) {
    case 'costs':
      return COST_METRICS
  }
}
