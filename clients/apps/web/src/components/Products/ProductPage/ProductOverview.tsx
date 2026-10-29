import { StatisticCard } from '@/components/Shared/StatisticCard'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ProductBenefits } from './ProductBenefits'
import { ProductDiscounts } from './ProductDiscounts'
import { ProductOrders } from './ProductOrders'
import { ProductSubscriptions } from './ProductSubscriptions'

export interface ProductOverviewProps {
  organization: schemas['Organization']
  product: schemas['Product']
  metrics?: schemas['MetricsResponse']
  todayMetrics?: schemas['MetricsResponse']
}

const formatMetric = (
  metric?: schemas['Metric'] | null,
  value?: number | null,
) => {
  if (!metric) return '—'
  return metric.type === 'scalar'
    ? formatHumanFriendlyScalar(value ?? 0)
    : formatCurrency('statistics')(value ?? 0, 'usd')
}

export const ProductOverview = ({
  organization,
  product,
  metrics,
  todayMetrics,
}: ProductOverviewProps) => {
  return (
    <Box flexDirection="column" rowGap="3xl">
      <Box
        display={{ base: 'grid', xl: 'flex' }}
        gridTemplateColumns="repeat(2, 1fr)"
        gap={{ base: 'l', md: 'xl' }}
      >
        {product.is_recurring ? (
          <>
            <StatisticCard title="Active Subscriptions" size="lg">
              {formatMetric(
                metrics?.metrics.active_subscriptions,
                metrics?.totals.active_subscriptions,
              )}
            </StatisticCard>
            <StatisticCard title="Monthly Recurring Revenue" size="lg">
              {formatMetric(
                metrics?.metrics.monthly_recurring_revenue,
                metrics?.totals.monthly_recurring_revenue,
              )}
            </StatisticCard>
          </>
        ) : (
          <>
            <StatisticCard title="One-Time Products" size="lg">
              {formatMetric(
                metrics?.metrics.one_time_products,
                metrics?.totals.one_time_products,
              )}
            </StatisticCard>
            <StatisticCard title="Today's Revenue" size="lg">
              {formatMetric(
                todayMetrics?.metrics.revenue,
                todayMetrics?.periods.at(-1)?.revenue,
              )}
            </StatisticCard>
          </>
        )}
        <StatisticCard title="Cumulative Revenue" size="lg">
          {formatMetric(
            metrics?.metrics.cumulative_revenue,
            metrics?.periods.at(-1)?.cumulative_revenue,
          )}
        </StatisticCard>
      </Box>
      {product.is_recurring && (
        <ProductSubscriptions organization={organization} product={product} />
      )}
      <ProductOrders organization={organization} product={product} />

      {product.is_archived ? (
        <ProductBenefits organization={organization} product={product} />
      ) : (
        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }}
          columnGap="2xl"
          rowGap="2xl"
        >
          <ProductBenefits organization={organization} product={product} />
          <ProductDiscounts organization={organization} product={product} />
        </Grid>
      )}
    </Box>
  )
}
