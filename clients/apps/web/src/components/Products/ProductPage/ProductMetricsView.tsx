import MetricChartBox from '@/components/Metrics/MetricChartBox'
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
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      {product.is_recurring ? (
        <>
          {subscriptionMetrics.map((metric) => (
            <MetricChartBox
              key={metric}
              data={data}
              loading={loading}
              metric={metric}
              interval={interval}
            />
          ))}
        </>
      ) : (
        <>
          {oneTimeMetrics.map((metric) => (
            <MetricChartBox
              key={metric}
              data={data}
              loading={loading}
              metric={metric}
              interval={interval}
            />
          ))}
        </>
      )}

      {orderMetrics.map((metric) => (
        <MetricChartBox
          key={metric}
          data={data}
          loading={loading}
          metric={metric}
          interval={interval}
        />
      ))}
    </div>
  )
}
