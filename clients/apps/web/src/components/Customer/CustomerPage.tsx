'use client'

import { BenefitGrantStatus } from '@/components/Benefit/BenefitGrantStatus'
import { CustomerEventsView } from '@/components/Customer/CustomerEventsView'
import { CustomerUsageView } from '@/components/Customer/CustomerUsageView'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  ParsedMetricsResponse,
  useBenefitGrants,
  useMetrics,
  useSubscriptions,
  useWallets,
} from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import {
  formatCurrency,
  formatHumanFriendlyCurrency,
  formatPercentage,
  formatScalar,
  formatSubCentCurrency,
} from '@/utils/formatters'
import { getPreviousDateRange } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { benefitsDisplayNames } from '../Benefit/utils'
import MetricChartBox from '../Metrics/MetricChartBox'
import { DetailRow } from '../Shared/DetailRow'
import { CustomerStatBox } from './CustomerStatBox'
import { CustomerTrendStatBox } from './CustomerTrendStatBox'

interface CustomerPageProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  dateRange: { startDate: Date; endDate: Date }
  interval: schemas['TimeInterval']
}

export const CustomerPage: React.FC<CustomerPageProps> = ({
  organization,
  customer,
  dateRange,
  interval,
}) => {
  const { data: orders, isLoading: ordersLoading } = useOrders(
    customer.organization_id,
    {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-created_at'],
    },
  )

  const { data: subscriptions, isLoading: subscriptionsLoading } =
    useSubscriptions(customer.organization_id, {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    })

  const { data: benefitGrants, isLoading: benefitGrantsLoading } =
    useBenefitGrants(customer.organization_id, {
      customer_id: [customer.id],
      limit: 999,
      sorting: ['-granted_at'],
    })

  const { data: billingWallets } = useWallets(organization.id, {
    customer_id: customer.id,
    type: 'billing',
  })

  const [selectedMetric, setSelectedMetric] = React.useState<
    keyof schemas['Metrics']
  >(organization.feature_settings?.revops_enabled ? 'cashflow' : 'revenue')

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
    organization.feature_settings?.revops_enabled ?? false,
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

    const allowedKeys: (keyof schemas['Metrics'])[] = [
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

    const metrics = Object.fromEntries(
      Object.entries(metricsData.metrics).filter(([key]) =>
        allowedKeys.includes(key as keyof schemas['Metrics']),
      ),
    ) as ParsedMetricsResponse['metrics']

    return {
      ...metricsData,
      metrics,
    }
  }, [metricsData])

  return (
    <Tabs defaultValue="overview" className="flex flex-col">
      <TabsList className="mb-8">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-y-8">
        <div className="grid grid-cols-2 flex-row gap-4 md:gap-6 xl:flex">
          {organization.feature_settings?.revops_enabled ? (
            <>
              <CustomerTrendStatBox
                title="Revenue"
                size="lg"
                trend={calculateTrend('revenue')}
              >
                {typeof metricsData?.totals.revenue === 'number'
                  ? formatHumanFriendlyCurrency(
                      metricsData.totals.revenue,
                      'usd',
                    )
                  : '—'}
              </CustomerTrendStatBox>
              <CustomerTrendStatBox
                title="Cost"
                size="lg"
                trend={calculateTrend('costs')}
                trendUpIsBad
              >
                {typeof metricsData?.totals.costs === 'number'
                  ? formatSubCentCurrency(metricsData.totals.costs, 'usd')
                  : '—'}
              </CustomerTrendStatBox>
              <CustomerTrendStatBox
                title="Profit"
                size="lg"
                trend={calculateTrend('gross_margin')}
              >
                {typeof metricsData?.totals.gross_margin === 'number'
                  ? formatHumanFriendlyCurrency(
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
            </>
          ) : (
            <>
              <CustomerStatBox title="Lifetime Revenue" size="lg">
                {typeof metricsData?.totals.cumulative_revenue === 'number'
                  ? formatHumanFriendlyCurrency(
                      metricsData.totals.cumulative_revenue,
                      'usd',
                    )
                  : '—'}
              </CustomerStatBox>
              <CustomerStatBox title="Orders" size="lg">
                {metricsData?.totals.orders
                  ? formatScalar(metricsData?.totals.orders)
                  : '—'}
              </CustomerStatBox>
            </>
          )}
          <CustomerStatBox title="Customer Balance" size="lg">
            {billingWallets && billingWallets.items.length > 0
              ? billingWallets.items.map((wallet) => (
                  <div key={wallet.id}>
                    {formatCurrencyAndAmount(wallet.balance, wallet.currency)}
                  </div>
                ))
              : '—'}
          </CustomerStatBox>
        </div>

        {/** Disabling this for now until we're satisfied with the layout/presentation design */}

        {/** organization.feature_settings?.revops_enabled && (}
          <CashflowChart
            organizationId={organization.id}
            customerId={customer.id}
            customerCreatedAt={customer.created_at}
          />
        ) */}

        <MetricChartBox
          metric={selectedMetric}
          onMetricChange={setSelectedMetric}
          interval={interval}
          data={relevantMetricsData}
          loading={metricsLoading}
        />

        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Subscriptions</h3>
          <DataTable
            data={subscriptions?.items ?? []}
            columns={[
              {
                header: 'Product Name',
                accessorKey: 'product.name',
                cell: ({ row: { original } }) => (
                  <span>{original.product.name}</span>
                ),
              },
              {
                header: 'Status',
                accessorKey: 'status',
                cell: ({ row: { original } }) => (
                  <SubscriptionStatusLabel
                    className="text-xs"
                    subscription={original}
                  />
                ),
              },
              {
                header: 'Amount',
                accessorKey: 'amount',
                cell: ({ row: { original } }) =>
                  original.amount && original.currency ? (
                    <AmountLabel
                      amount={original.amount}
                      currency={original.currency}
                      interval={original.recurring_interval}
                      intervalCount={original.recurring_interval_count}
                    />
                  ) : (
                    <span>—</span>
                  ),
              },
              {
                header: '',
                accessorKey: 'action',
                cell: ({ row: { original } }) => (
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/${organization.slug}/sales/subscriptions/${original.id}`}
                    >
                      <Button variant="secondary" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ),
              },
            ]}
            isLoading={subscriptionsLoading}
            className="text-sm"
          />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Orders</h3>

          <DataTable
            data={orders?.items ?? []}
            columns={[
              {
                header: 'Description',
                accessorKey: 'description',
                cell: ({ row: { original } }) => (
                  <Link
                    href={`/dashboard/${organization?.slug}/sales/${original.id}`}
                    key={original.id}
                  >
                    <span>{original.description}</span>
                  </Link>
                ),
              },
              {
                header: 'Created At',
                accessorKey: 'created_at',
                cell: ({ row: { original } }) => (
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    <FormattedDateTime datetime={original.created_at} />
                  </span>
                ),
              },
              {
                header: 'Amount',
                accessorKey: 'amount',
                cell: ({ row: { original } }) =>
                  formatCurrency(original.net_amount, original.currency),
              },
              {
                header: '',
                accessorKey: 'action',
                cell: ({ row: { original } }) => (
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/${organization.slug}/sales/${original.id}`}
                    >
                      <Button variant="secondary" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ),
              },
            ]}
            isLoading={ordersLoading}
            className="text-sm"
          />
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Benefit Grants</h3>
          <DataTable
            data={benefitGrants?.items ?? []}
            columns={[
              {
                header: 'Benefit Name',
                accessorKey: 'benefit.description',
                cell: ({ row: { original } }) => (
                  <div className="flex flex-col gap-0.5">
                    <span>{original.benefit.description}</span>

                    <span className="dark:text-polar-500 text-xs text-gray-500">
                      {benefitsDisplayNames[original.benefit.type]}
                    </span>
                  </div>
                ),
              },
              {
                header: 'Status',
                accessorKey: 'status',
                cell: ({ row: { original: grant } }) => (
                  <BenefitGrantStatus grant={grant} />
                ),
              },
              {
                header: 'Granted At',
                accessorKey: 'granted_at',
                cell: ({ row: { original } }) =>
                  original.granted_at ? (
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      <FormattedDateTime datetime={original.granted_at} />
                    </span>
                  ) : (
                    <span>—</span>
                  ),
              },
              {
                header: 'Revoked At',
                accessorKey: 'revoked_at',
                cell: ({ row: { original } }) =>
                  original.revoked_at ? (
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      <FormattedDateTime datetime={original.revoked_at} />
                    </span>
                  ) : (
                    <span className="dark:text-polar-800 text-gray-400">—</span>
                  ),
              },
              {
                header: '',
                accessorKey: 'benefit_action',
                cell: ({ row: { original } }) => (
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/${organization.slug}/products/benefits/${original.benefit.id}`}
                    >
                      <Button variant="secondary" size="sm">
                        View Benefit
                      </Button>
                    </Link>
                  </div>
                ),
              },
            ]}
            isLoading={benefitGrantsLoading}
            className="text-sm"
          />
        </div>

        <ShadowBox className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg">Customer Details</h2>
            <div className="flex flex-col">
              <DetailRow label="ID" value={customer.id} />
              <DetailRow label="External ID" value={customer.external_id} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Name" value={customer.name} />
              <DetailRow
                label="Tax ID"
                value={
                  customer.tax_id ? (
                    <span className="flex flex-row items-center gap-1.5">
                      <span>{customer.tax_id[0]}</span>
                      <span className="font-mono text-xs opacity-70">
                        {customer.tax_id[1]
                          .toLocaleUpperCase()
                          .replace('_', ' ')}
                      </span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="Created At"
                value={<FormattedDateTime datetime={customer.created_at} />}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-lg">Billing Address</h4>
            <div className="flex flex-col">
              <DetailRow
                label="Line 1"
                value={customer.billing_address?.line1}
              />
              <DetailRow
                label="Line 2"
                value={customer.billing_address?.line2}
              />
              <DetailRow label="City" value={customer.billing_address?.city} />
              <DetailRow
                label="State"
                value={customer.billing_address?.state}
              />
              <DetailRow
                label="Postal Code"
                value={customer.billing_address?.postal_code}
              />
              <DetailRow
                label="Country"
                value={customer.billing_address?.country}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <h3 className="text-lg">Metadata</h3>
            </div>
            {Object.entries(customer.metadata).map(([key, value]) => (
              <DetailRow key={key} label={key} value={value} />
            ))}
          </div>
        </ShadowBox>
      </TabsContent>
      <CustomerUsageView
        customer={customer}
        dateRange={dateRange}
        interval={interval}
      />
      <CustomerEventsView
        customer={customer}
        organization={organization}
        dateRange={dateRange}
      />
    </Tabs>
  )
}
