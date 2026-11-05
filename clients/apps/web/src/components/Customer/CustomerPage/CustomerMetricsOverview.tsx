'use client'

import { MetricGroup } from '@/components/Metrics/dashboards/MetricGroup'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { getNextValidInterval } from '@/components/Metrics/IntervalPicker'
import { ParsedMetricsResponse, useMetrics } from '@/hooks/queries'
import { getCustomerActivityStart } from '@/utils/customer'
import { formatCostAmount, formatPercentage } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfToday, startOfDay } from 'date-fns'
import React, { useMemo } from 'react'
import { CustomerMetricsRangeControl } from './CustomerMetricsRangeControl'

const RELEVANT_METRIC_KEYS: (keyof schemas['Metrics'])[] = [
  'active_subscriptions',
  'average_order_value',
  'canceled_subscriptions',
  'checkouts',
  'checkouts_conversion',
  'committed_monthly_recurring_revenue',
  'costs',
  'cumulative_costs',
  'cumulative_revenue',
  'monthly_recurring_revenue',
  'net_average_order_value',
  'net_cumulative_revenue',
  'net_revenue',
  'cashflow',
  'gross_margin',
  'gross_margin_percentage',
  'new_subscriptions',
  'new_subscriptions_net_revenue',
  'new_subscriptions_revenue',
  'one_time_products',
  'one_time_products_net_revenue',
  'one_time_products_revenue',
  'orders',
  'renewed_subscriptions',
  'renewed_subscriptions_net_revenue',
  'renewed_subscriptions_revenue',
  'revenue',
  'succeeded_checkouts',
]

const CHART_METRICS: (keyof schemas['Metrics'])[] = [
  'cashflow',
  'revenue',
  'net_revenue',
  'costs',
  'orders',
]

interface CustomerMetricsOverviewProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  dateRange: { startDate: Date; endDate: Date }
  interval: schemas['TimeInterval']
}

export const CustomerMetricsOverview = ({
  organization,
  customer,
  dateRange,
  interval,
}: CustomerMetricsOverviewProps) => {
  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    organization_id: organization.id,
    interval,
    customer_id: [customer.id],
  })

  const [allTimeRange] = React.useState(() => {
    const startDate = startOfDay(getCustomerActivityStart(customer))
    const endDate = endOfToday()
    return {
      startDate,
      endDate,
      interval: getNextValidInterval('month', startDate, endDate),
    }
  })

  const { data: allTimeData } = useMetrics({
    ...allTimeRange,
    organization_id: organization.id,
    customer_id: [customer.id],
  })
  const totals = allTimeData?.totals

  const relevantMetricsData = useMemo(() => {
    if (!metricsData) {
      return metricsData
    }

    const metrics = Object.fromEntries(
      Object.entries(metricsData.metrics).filter(([key]) =>
        RELEVANT_METRIC_KEYS.includes(key as keyof schemas['Metrics']),
      ),
    ) as ParsedMetricsResponse['metrics']

    return {
      ...metricsData,
      metrics,
    }
  }, [metricsData])

  return (
    <>
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))"
        gap={{ base: 'l', md: 'xl' }}
      >
        <StatisticCard title="Revenue" size="lg">
          {typeof totals?.revenue === 'number'
            ? formatCurrency('statistics')(totals.revenue, 'usd')
            : '—'}
        </StatisticCard>
        <StatisticCard title="Cost" size="lg">
          {typeof totals?.costs === 'number'
            ? formatCostAmount(totals.costs)
            : '—'}
        </StatisticCard>
        <StatisticCard title="Profit" size="lg">
          {typeof totals?.gross_margin === 'number'
            ? formatCurrency('statistics')(totals.gross_margin, 'usd')
            : '—'}
        </StatisticCard>
        <StatisticCard title="Profit Margin" size="lg">
          {typeof totals?.gross_margin_percentage === 'number'
            ? formatPercentage(totals.gross_margin_percentage)
            : '—'}
        </StatisticCard>
      </Box>

      <Box flexDirection="column" rowGap="xl">
        <Box
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems={{ base: 'start', md: 'center' }}
          justifyContent="between"
          gap="l"
        >
          <Text as="h2" variant="heading-xxs">
            Metrics
          </Text>
          <CustomerMetricsRangeControl customer={customer} />
        </Box>
        <MetricGroup
          metricKeys={CHART_METRICS}
          data={relevantMetricsData}
          interval={interval}
          loading={metricsLoading}
          context={customer.name ?? customer.email ?? undefined}
        />
      </Box>
    </>
  )
}
