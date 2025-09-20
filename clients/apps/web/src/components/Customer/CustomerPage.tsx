'use client'

import { CustomerEventsView } from '@/components/Customer/CustomerEventsView'
import { CustomerUsageView } from '@/components/Customer/CustomerUsageView'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  ParsedMetricsResponse,
  useCustomerState,
  useListSubscriptions,
  useMetrics,
} from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { getChartRangeParams } from '@/utils/metrics'
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
import Link from 'next/link'
import React, { useMemo } from 'react'
import MetricChartBox from '../Metrics/MetricChartBox'
import { DetailRow } from '../Shared/DetailRow'

interface CustomerPageProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerPage: React.FC<CustomerPageProps> = ({
  organization,
  customer,
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
    useListSubscriptions(customer.organization_id, {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    })

  const { data: customerState, isLoading: customerStateLoading } = useCustomerState(customer.id)

  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams('all_time', customer.created_at),
    [customer.created_at],
  )
  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate,
    endDate,
    organization_id: organization.id,
    interval,
    customer_id: [customer.id],
  })

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
      'cumulative_revenue',
      'monthly_recurring_revenue',
      'net_average_order_value',
      'net_cumulative_revenue',
      'net_revenue',
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
      <TabsContent value="overview" className="flex flex-col gap-y-12">
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
          <h3 className="text-lg">Benefits</h3>
          <DataTable
            data={customerState?.granted_benefits ?? []}
            columns={[
              {
                header: 'Benefit Type',
                accessorKey: 'benefit_type',
                cell: ({ row: { original } }) => (
                  <span className="capitalize">{original.benefit_type.replace('_', ' ')}</span>
                ),
              },
              {
                header: 'Granted At',
                accessorKey: 'granted_at',
                cell: ({ row: { original } }) => (
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    <FormattedDateTime datetime={original.granted_at} />
                  </span>
                ),
              },
              {
                header: 'Properties',
                accessorKey: 'properties',
                cell: ({ row: { original } }) => {
                  const properties = original.properties
                  if (!properties || Object.keys(properties).length === 0) {
                    return <span className="text-gray-400">—</span>
                  }
                  return (
                    <div className="max-w-xs truncate text-sm">
                      {Object.entries(properties).map(([key, value]) => (
                        <div key={key} className="truncate">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )
                },
              },
              {
                header: '',
                accessorKey: 'action',
                cell: ({ row: { original } }) => (
                  <div className="flex justify-end">
                    <Link
                      href={`/dashboard/${organization.slug}/benefits`}
                    >
                      <Button variant="secondary" size="sm">
                        View All Benefits
                      </Button>
                    </Link>
                  </div>
                ),
              },
            ]}
            isLoading={customerStateLoading}
            className="text-sm"
          />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Orders</h3>

          <DataTable
            data={orders?.items ?? []}
            columns={[
              {
                header: 'Product Name',
                accessorKey: 'product.name',
                cell: ({ row: { original } }) => (
                  <Link
                    href={`/dashboard/${organization?.slug}/sales/${original.id}`}
                    key={original.id}
                  >
                    <span>{original.product.name}</span>
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
                cell: ({ row: { original } }) => (
                  <AmountLabel
                    amount={original.net_amount}
                    currency={original.currency}
                  />
                ),
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

        <ShadowBox className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl">Customer Details</h2>
            <div className="flex flex-col">
              <DetailRow label="ID" value={customer.id} />
              <DetailRow label="External ID" value={customer.external_id} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Name" value={customer.name} />
              <DetailRow
                label="Tax ID"
                value={customer.tax_id ? customer.tax_id[0] : null}
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
      <CustomerUsageView customer={customer} />
      <TabsContent value="events">
        <CustomerEventsView customer={customer} organization={organization} />
      </TabsContent>
    </Tabs>
  )
}
