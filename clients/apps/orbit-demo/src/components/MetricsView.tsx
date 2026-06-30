import { Box } from '@polar-sh/orbit/Box'
import { formatCompactMoney, formatCompactNumber, METRICS } from '@/data/metrics'
import { ChurnChart } from './metrics/ChurnChart'
import { CountriesBreakdown } from './metrics/CountriesBreakdown'
import { KpiCard, type KpiCardProps } from './metrics/KpiCard'
import { MrrChart } from './metrics/MrrChart'
import { OrdersChart } from './metrics/OrdersChart'
import { ProductsBreakdown } from './metrics/ProductsBreakdown'
import { RevenueChart } from './metrics/RevenueChart'

const t = METRICS.totals
const daily = METRICS.daily

const direction = (n: number): 'up' | 'down' => (n >= 0 ? 'up' : 'down')

const KPIS: KpiCardProps[] = [
  {
    label: 'Revenue',
    value: formatCompactMoney(t.revenueCents),
    delta: { value: t.revenueDeltaPct, direction: direction(t.revenueDeltaPct) },
    spark: daily.map((d) => d.revenueCents),
    accent: 'primary',
  },
  {
    label: 'MRR',
    value: formatCompactMoney(t.mrrCents),
    delta: {
      value: t.mrrDeltaPct,
      direction: direction(t.mrrDeltaPct),
      tone: 'neutral',
    },
    spark: daily.map((d) => d.mrrCents),
    accent: 'primary',
  },
  {
    label: 'Active subscribers',
    value: formatCompactNumber(t.activeSubs),
    delta: {
      value: t.activeSubsDeltaPct,
      direction: direction(t.activeSubsDeltaPct),
    },
    spark: daily.map((d) => d.activeSubs),
    accent: 'primary',
  },
  {
    label: 'Orders',
    value: formatCompactNumber(t.ordersCount),
    delta: { value: t.ordersDeltaPct, direction: direction(t.ordersDeltaPct) },
    spark: daily.map((d) => d.ordersCount),
    accent: 'primary',
  },
  {
    label: 'ARPU',
    value: formatCompactMoney(t.arpuCents),
    delta: { value: t.arpuDeltaPct, direction: direction(t.arpuDeltaPct) },
    spark: daily.map((d) =>
      Math.round(d.mrrCents / Math.max(1, d.activeSubs)),
    ),
    accent: 'primary',
  },
  {
    label: 'Churn',
    value: `${t.churnPct.toFixed(2)}%`,
    delta: {
      value: t.churnDeltaPct,
      direction: direction(t.churnDeltaPct),
      tone: 'neutral',
    },
    spark: daily.map((d) => d.churnPct),
    accent: 'primary',
  },
]

export const MetricsView = () => (
  <Box display="flex" flexDirection="column" rowGap="3xl">
    <Box
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)',
      }}
      gap="xl"
    >
      {KPIS.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </Box>

    <RevenueChart />

    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap="xl"
    >
      <OrdersChart />
      <MrrChart />
    </Box>

    <ChurnChart />

    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap="xl"
    >
      <ProductsBreakdown />
      <CountriesBreakdown />
    </Box>
  </Box>
)
