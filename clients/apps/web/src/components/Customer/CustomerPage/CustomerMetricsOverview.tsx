'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { ParsedMetricsResponse, useMetrics, useWallets } from '@/hooks/queries'
import { formatPercentage } from '@/utils/formatters'
import { getPreviousDateRange } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Box } from '@polar-sh/orbit/Box'
import React, { useMemo } from 'react'
import { CustomerTrendStatBox } from './CustomerTrendStatBox'

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
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('cashflow')

  const { data: billingWallets } = useWallets(organization.id, {
    customer_id: customer.id,
    type: 'billing',
  })

  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    organization_id: organization.id,
    interval,
    customer_id: [customer.id],
  })

  const { data: previousPeriodMetrics } = useMetrics(
    {
      startDate: getPreviousDateRange(
        dateRange.startDate,
        dateRange.endDate,
      )[0],
      endDate: getPreviousDateRange(dateRange.startDate, dateRange.endDate)[1],
      organization_id: organization.id,
      interval: interval,
      customer_id: [customer.id],
    },
    true,
  )

  const calculateTrend = React.useCallback(
    (
      metricKey: keyof schemas['MetricsTotals'],
    ):
      | {
          value: number
          direction: 'up' | 'down' | 'none'
          metric: schemas['Metric']
          previousValue: number
        }
      | undefined => {
      if (!metricsData?.totals || !previousPeriodMetrics?.totals) {
        return undefined
      }

      const metric = metricsData.metrics[metricKey]
      if (!metric) {
        return undefined
      }
      const currentValue = metricsData.totals[metricKey]
      const previousValue = previousPeriodMetrics.totals[metricKey]

      if (
        typeof currentValue !== 'number' ||
        typeof previousValue !== 'number'
      ) {
        return undefined
      }

      if (previousValue === 0) {
        if (currentValue === 0)
          return { value: 0, direction: 'none', metric, previousValue }
        return { value: 100, direction: 'up', metric, previousValue }
      }

      const percentageChange =
        ((currentValue - previousValue) / Math.abs(previousValue)) * 100

      if (Math.abs(percentageChange) < 0.01) {
        return { value: 0, direction: 'none', metric, previousValue }
      }

      return {
        value: percentageChange,
        direction: percentageChange > 0 ? 'up' : 'down',
        previousValue,
        metric,
      }
    },
    [metricsData, previousPeriodMetrics],
  )

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
        display={{ base: 'grid', xl: 'flex' }}
        gridTemplateColumns="repeat(2, 1fr)"
        gap={{ base: 'l', md: 'xl' }}
      >
        <CustomerTrendStatBox
          title="Revenue"
          size="lg"
          trend={calculateTrend('revenue')}
        >
          {typeof metricsData?.totals.revenue === 'number'
            ? formatCurrency('statistics')(metricsData.totals.revenue, 'usd')
            : '—'}
        </CustomerTrendStatBox>
        <CustomerTrendStatBox
          title="Cost"
          size="lg"
          trend={calculateTrend('costs')}
          trendUpIsBad
        >
          {typeof metricsData?.totals.costs === 'number'
            ? formatCurrency('subcent')(metricsData.totals.costs, 'usd')
            : '—'}
        </CustomerTrendStatBox>
        <CustomerTrendStatBox
          title="Profit"
          size="lg"
          trend={calculateTrend('gross_margin')}
        >
          {typeof metricsData?.totals.gross_margin === 'number'
            ? formatCurrency('statistics')(
                metricsData.totals.gross_margin,
                'usd',
              )
            : '—'}
        </CustomerTrendStatBox>
        <CustomerTrendStatBox
          title="Profit Margin"
          size="lg"
          trend={calculateTrend('gross_margin_percentage')}
        >
          {typeof metricsData?.totals.gross_margin_percentage === 'number'
            ? formatPercentage(metricsData.totals.gross_margin_percentage)
            : '—'}
        </CustomerTrendStatBox>
        <StatisticCard title="Customer Balance" size="lg">
          {billingWallets && billingWallets.items.length > 0
            ? billingWallets.items.map((wallet) => (
                <div key={wallet.id}>
                  {formatCurrency('statistics')(
                    wallet.balance,
                    wallet.currency,
                  )}
                </div>
              ))
            : '—'}
        </StatisticCard>
      </Box>

      <MetricChartBox
        metric={selectedMetric}
        onMetricChange={setSelectedMetric}
        interval={interval}
        data={relevantMetricsData}
        loading={metricsLoading}
      />
    </>
  )
}
