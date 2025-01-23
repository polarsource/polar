'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { CustomerUsageView } from '@/components/Customer/CustomerUsageView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChart from '@/components/Metrics/MetricChart'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionModal } from '@/components/Subscriptions/SubscriptionModal'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import { usePostHog } from '@/hooks/posthog'
import { useListSubscriptions, useMetrics } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { Customer, Organization } from '@polar-sh/api'
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
import { RowSelectionState } from '@tanstack/react-table'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

interface ClientPageProps {
  organization: Organization
  customer: Customer
}

const ClientPage: React.FC<ClientPageProps> = ({ organization, customer }) => {
  const { data: orders, isLoading: ordersLoading } = useOrders(
    customer.organization_id,
    {
      customerId: customer.id,
      limit: 999,
      sorting: ['-created_at'],
    },
  )

  const { data: subscriptions, isLoading: subscriptionsLoading } =
    useListSubscriptions(customer.organization_id, {
      customerId: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    })

  const threeMonthsAgo = new Date(
    new Date().setMonth(new Date().getMonth() - 3),
  )
  const customerCreatedAt = new Date(customer.created_at)
  const startDate =
    customerCreatedAt > threeMonthsAgo ? threeMonthsAgo : customerCreatedAt

  const metrics = useMetrics({
    startDate: startDate,
    endDate: new Date(),
    organizationId: organization.id,
    interval: 'month',
    customerId: [customer.id],
  })

  const [selectedSubscriptionState, setSelectedSubscriptionState] =
    useState<RowSelectionState>({})

  const selectedSubscription = subscriptions?.items.find(
    (subscription) => selectedSubscriptionState[subscription.id],
  )

  const {
    show: showSubscriptionModal,
    hide: hideSubscriptionModal,
    isShown: isSubscriptionModalShown,
  } = useModal()

  useEffect(() => {
    if (selectedSubscription) {
      showSubscriptionModal()
    } else {
      hideSubscriptionModal()
    }
  }, [selectedSubscription, showSubscriptionModal, hideSubscriptionModal])

  const { isFeatureEnabled } = usePostHog()

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-normal">{customer.email}</h2>
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {customer.id}
          </span>
        </div>
      }
      contextView={<CustomerContextView customer={customer} />}
    >
      <Tabs defaultValue="overview" className="flex flex-col">
        <TabsList className="mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isFeatureEnabled('usage_based_billing') && (
            <TabsTrigger value="usage">Usage</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-y-12">
          {metrics.data?.metrics && (
            <div className="dark:border-polar-700 rounded-4xl flex flex-col gap-4 border border-gray-200 p-12">
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl">Revenue</h3>
                  <span className="dark:text-polar-500 text-gray-500">
                    Since Customer first was seen
                  </span>
                </div>
                <h3 className="text-xl">
                  <AmountLabel
                    amount={
                      metrics.data.periods[metrics.data.periods.length - 1]
                        .cumulative_revenue
                    }
                    currency="USD"
                  />
                </h3>
              </div>
              <MetricChart
                data={metrics.data.periods}
                metric={metrics.data.metrics.revenue}
                interval="month"
                height={300}
              />
            </div>
          )}
          <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-gray-100 bg-transparent p-0">
            <div className="flex flex-col gap-4 p-12">
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
                ]}
                isLoading={subscriptionsLoading}
                className="text-sm"
                onRowSelectionChange={(row) => {
                  setSelectedSubscriptionState(row)
                }}
                rowSelection={selectedSubscriptionState}
                getRowId={(row) => row.id.toString()}
                enableRowSelection
              />
              <InlineModal
                modalContent={
                  <SubscriptionModal
                    organization={organization}
                    subscription={selectedSubscription}
                  />
                }
                isShown={isSubscriptionModalShown}
                hide={() => {
                  setSelectedSubscriptionState({})
                  hideSubscriptionModal()
                }}
              />
            </div>
            <div className="flex flex-col gap-4 p-12">
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
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        <FormattedDateTime datetime={original.created_at} />
                      </span>
                    ),
                  },
                  {
                    header: 'Amount',
                    accessorKey: 'amount',
                    cell: ({ row: { original } }) => (
                      <AmountLabel
                        amount={original.amount}
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
          </ShadowBox>
        </TabsContent>
        {isFeatureEnabled('usage_based_billing') && (
          <CustomerUsageView customer={customer} />
        )}
      </Tabs>
    </DashboardBody>
  )
}

export default ClientPage
