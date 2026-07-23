import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { schemas } from '@polar-sh/client'
import { ProductDiscounts } from './ProductDiscounts'
import { ProductOrders } from './ProductOrders'
import { ProductSubscriptions } from './ProductSubscriptions'

export interface ProductOverviewProps {
  organization: schemas['Organization']
  product: schemas['Product']
  metrics?: schemas['MetricsResponse']
  todayMetrics?: schemas['MetricsResponse']
}

export const ProductOverview = ({
  organization,
  product,
  metrics,
  todayMetrics,
}: ProductOverviewProps) => {
  return (
    <div className="flex flex-col gap-y-16">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {product.is_recurring ? (
          <>
            <MiniMetricChartBox
              title="Active Subscriptions"
              metric={metrics?.metrics.active_subscriptions}
              value={metrics?.totals.active_subscriptions}
            />
            <MiniMetricChartBox
              title="Monthly Recurring Revenue"
              metric={metrics?.metrics.monthly_recurring_revenue}
              value={metrics?.totals.monthly_recurring_revenue}
            />
          </>
        ) : (
          <>
            <MiniMetricChartBox
              metric={metrics?.metrics.one_time_products}
              value={metrics?.totals.one_time_products}
            />
            <MiniMetricChartBox
              title="Today's Revenue"
              metric={todayMetrics?.metrics.revenue}
              value={todayMetrics?.periods.at(-1)?.revenue}
            />
          </>
        )}
        <MiniMetricChartBox
          metric={metrics?.metrics.cumulative_revenue}
          value={metrics?.periods.at(-1)?.cumulative_revenue}
        />
      </div>
      {product.is_recurring && (
        <ProductSubscriptions organization={organization} product={product} />
      )}
      <ProductOrders organization={organization} product={product} />

      {!product.is_archived && (
        <ProductDiscounts organization={organization} product={product} />
      )}
    </div>
  )
}
