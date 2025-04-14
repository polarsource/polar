'use client'

import { CustomerEventsView } from '@/components/Customer/CustomerEventsView'
import { CustomerUsageView } from '@/components/Customer/CustomerUsageView'
import MetricChart from '@/components/Metrics/MetricChart'
import AmountLabel from '@/components/Shared/AmountLabel'
import Spinner from '@/components/Shared/Spinner'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  ParsedMetricPeriod,
  useListSubscriptions,
  useMetrics,
} from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import {
  computeCumulativeValue,
  dateToInterval,
  defaultMetricMarks,
  metricDisplayNames,
} from '@/utils/metrics'
import { AddOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { DetailRow } from '../Shared/DetailRow'
import { EditCustomerModal } from './EditCustomerModal'

type Range = 'all_time' | '12m' | '3m' | '30d' | '24h'

const rangeDisplayNames: Record<Range, string> = {
  all_time: 'First Seen',
  '12m': '12m',
  '3m': '3m',
  '30d': '30d',
  '24h': '24h',
}

const getRangeStartDate = (range: Range, customer: schemas['Customer']) => {
  switch (range) {
    case 'all_time':
      return new Date(customer.created_at)
    case '12m':
      return new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    case '3m':
      return new Date(new Date().setMonth(new Date().getMonth() - 3))
    case '30d':
      return new Date(new Date().setDate(new Date().getDate() - 30))
    case '24h':
      return new Date(new Date().setHours(new Date().getHours() - 24))
  }
}

interface CustomerPageProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerPage: React.FC<CustomerPageProps> = ({
  organization,
  customer,
}) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [hoveredMetricPeriod, setHoveredMetricPeriod] =
    React.useState<ParsedMetricPeriod | null>(null)

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

  const [selectedRange, setSelectedRange] = React.useState<Range>('all_time')

  const startDate = getRangeStartDate(selectedRange, customer)
  const interval = useMemo(() => dateToInterval(startDate), [startDate])
  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate: startDate,
    endDate: new Date(),
    organization_id: organization.id,
    interval,
    customer_id: [customer.id],
  })

  const metricValue = useMemo(() => {
    if (!metricsData) return 0

    const currentMetricPeriod = hoveredMetricPeriod
      ? hoveredMetricPeriod
      : metricsData.periods[metricsData.periods.length - 1]

    const metric = metricsData.metrics[selectedMetric]
    const value = hoveredMetricPeriod
      ? currentMetricPeriod[selectedMetric]
      : computeCumulativeValue(
          metric,
          metricsData.periods.map((period) => period[selectedMetric]),
        )

    if (metric?.type === 'currency') {
      return `$${getCentsInDollarString(value ?? 0)}`
    } else {
      return value
    }
  }, [hoveredMetricPeriod, metricsData, selectedMetric])

  const {
    isShown: isEditCustomerModalShown,
    show: showEditCustomerModal,
    hide: hideEditCustomerModal,
  } = useModal()

  return (
    <Tabs defaultValue="overview" className="flex flex-col">
      <TabsList className="mb-8">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {organization.feature_settings?.usage_based_billing_enabled && (
          <TabsTrigger value="usage">Usage</TabsTrigger>
        )}
        {organization.feature_settings?.usage_based_billing_enabled && (
          <TabsTrigger value="events">Events</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-y-12">
        <ShadowBox className="dark:bg-polar-800 flex flex-col bg-gray-50 p-2 shadow-sm">
          <div className="flex flex-row justify-between p-6">
            <div className="flex flex-col gap-3">
              <Select
                value={selectedMetric}
                onValueChange={(value) =>
                  setSelectedMetric(value as keyof schemas['Metrics'])
                }
              >
                <SelectTrigger className="h-fit w-fit border-0 border-none bg-transparent p-0 shadow-none ring-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent">
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
                  {Object.entries(metricDisplayNames).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <h2 className="text-3xl">{metricValue}</h2>
              <div className="flex flex-row items-center gap-x-6">
                <div className="flex flex-row items-center gap-x-2">
                  <span className="h-3 w-3 rounded-full border-2 border-blue-500" />
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    Current Period
                  </span>
                </div>
                {hoveredMetricPeriod && (
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="h-3 w-3 rounded-full border-2 border-gray-500 dark:border-gray-700" />
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      <FormattedDateTime
                        datetime={hoveredMetricPeriod.timestamp}
                        dateStyle="medium"
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Tabs
              value={selectedRange}
              onValueChange={(value) => setSelectedRange(value as Range)}
            >
              <TabsList className="dark:bg-polar-900 flex flex-row gap-x-0 rounded-md bg-white">
                {Object.entries(rangeDisplayNames).map(([key, value]) => (
                  <TabsTrigger
                    size="small"
                    key={key}
                    value={key}
                    className="!rounded-sm p-1 px-2 text-xs font-normal"
                  >
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="dark:bg-polar-900 flex flex-col gap-y-2 rounded-3xl bg-white p-4">
            {metricsLoading ? (
              <div className="flex h-[300px] flex-col items-center justify-center">
                <Spinner />
              </div>
            ) : metricsData ? (
              <MetricChart
                height={300}
                data={metricsData.periods}
                interval={interval}
                marks={defaultMetricMarks}
                metric={metricsData.metrics[selectedMetric]}
                onDataIndexHover={(period) =>
                  setHoveredMetricPeriod(
                    metricsData.periods[period as number] ?? null,
                  )
                }
              />
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center">
                <span className="text-lg">No data available</span>
              </div>
            )}
          </div>
        </ShadowBox>
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

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <ShadowBox className="flex flex-col gap-8">
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
          </ShadowBox>
          <ShadowBox className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <h3 className="text-lg">Metadata</h3>
              <Button
                className="h-6 w-6"
                size="icon"
                onClick={showEditCustomerModal}
              >
                <AddOutlined />
              </Button>
            </div>
            {Object.entries(customer.metadata).map(([key, value]) => (
              <DetailRow
                key={key}
                label={key}
                value={value}
                valueClassName="dark:bg-polar-800 bg-gray-100"
              />
            ))}
          </ShadowBox>
        </div>
      </TabsContent>
      {organization.feature_settings?.usage_based_billing_enabled && (
        <CustomerUsageView customer={customer} />
      )}
      <TabsContent value="events">
        <CustomerEventsView customer={customer} organization={organization} />
      </TabsContent>
      <InlineModal
        isShown={isEditCustomerModalShown}
        hide={hideEditCustomerModal}
        modalContent={
          <EditCustomerModal
            customer={customer}
            onClose={hideEditCustomerModal}
          />
        }
      />
    </Tabs>
  )
}
