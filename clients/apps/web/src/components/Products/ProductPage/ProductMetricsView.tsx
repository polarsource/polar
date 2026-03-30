import { MetricGroup } from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/MetricGroup'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

export interface ProductMetricsViewProps {
  data?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  loading: boolean
  product: schemas['Product']
}

export const ProductMetricsView = ({
  data,
  loading,
  interval,
  product,
}: ProductMetricsViewProps) => {
  const subscriptionMetrics: (keyof schemas['Metrics'])[] = [
    'monthly_recurring_revenue',
    'committed_monthly_recurring_revenue',
    'active_subscriptions',
    'new_subscriptions',
    'renewed_subscriptions',
    'new_subscriptions_revenue',
    'renewed_subscriptions_revenue',
  ]

  const oneTimeMetrics: (keyof schemas['Metrics'])[] = [
    'one_time_products',
    'one_time_products_revenue',
  ]

  const orderMetrics: (keyof schemas['Metrics'])[] = product.is_recurring
    ? ['revenue', 'orders', 'average_order_value', 'cumulative_revenue']
    : ['average_order_value', 'cumulative_revenue']

  return (
    <div className="flex flex-col gap-y-12">
      {product.is_recurring ? (
        <MetricGroup
          metricKeys={subscriptionMetrics}
          data={data}
          interval={interval}
          loading={loading}
        />
      ) : (
        <MetricGroup
          metricKeys={oneTimeMetrics}
          data={data}
          interval={interval}
          loading={loading}
        />
      )}
      <MetricGroup
        metricKeys={orderMetrics}
        data={data}
        interval={interval}
        loading={loading}
      />
    </div>
  )
}
