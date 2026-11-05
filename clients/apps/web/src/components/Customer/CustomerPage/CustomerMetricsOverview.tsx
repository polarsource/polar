'use client'

import { MetricGroup } from '@/components/Metrics/dashboards/MetricGroup'
import { ParsedMetricsResponse, useMetrics } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
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
  'revenue',
  'costs',
  'gross_margin',
  'gross_margin_percentage',
  'orders',
]

const DISPLAY_NAMES: Record<string, string> = {
  gross_margin: 'Profit',
  gross_margin_percentage: 'Profit Margin',
}

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

  const relevantMetricsData = useMemo(() => {
    if (!metricsData) {
      return metricsData
    }

    const metrics = Object.fromEntries(
      Object.entries(metricsData.metrics)
        .filter(([key]) =>
          RELEVANT_METRIC_KEYS.includes(key as keyof schemas['Metrics']),
        )
        .map(([key, metric]) =>
          key in DISPLAY_NAMES && metric
            ? [key, { ...metric, display_name: DISPLAY_NAMES[key] }]
            : [key, metric],
        ),
    ) as ParsedMetricsResponse['metrics']

    return {
      ...metricsData,
      metrics,
    }
  }, [metricsData])

  return (
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
  )
}
