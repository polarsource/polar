'use client'

import { AddCreditsModal } from '@/components/Customer/AddCredits/AddCreditsModal'
import { useModal } from '@/components/Modal/useModal'
import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import { useHasPermission } from '@/hooks/permissions'
import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMultipleMeterQuantities } from '@/hooks/queries/meters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@polar-sh/currency'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Button,
  DataTable,
  DataTableColumnHeader,
  InlineModal,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Suspense, useMemo, useState } from 'react'
import FormattedUnits from '../../Meter/FormattedUnits'
import { EmptyState } from '../../Shared/EmptyState'
import { CircleGauge as GaugeCircleIcon } from '@polar-sh/orbit/icons'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

const StackedMeterChart = dynamic(() => import('../../Meter/StackedMeterChart'))

const METER_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#db2777',
]

type CustomerMeterWithSubscription = schemas['CustomerMeter'] & {
  subscription: schemas['Subscription'] | null
}

type MeterRow = CustomerMeterWithSubscription & {
  color: string
  overages: { cost: number; currency: string } | null
}

const getOverages = (cm: CustomerMeterWithSubscription) => {
  if (!cm.subscription || cm.balance >= 0) return null

  const unitPrice = cm.subscription.product.prices.find(
    (price): price is MeteredPrice =>
      isMeteredPrice(price) && price.meter_id === cm.meter.id,
  )
  if (!unitPrice) return null

  const overageUnits = Math.abs(cm.balance)
  return {
    cost: estimateMeteredCost(unitPrice, overageUnits),
    currency: unitPrice.price_currency,
  }
}

export const CustomerUsageView = ({
  customer,
  organization,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const addCreditsModal = useModal()
  const canAddCredits = useHasPermission(organization.id, 'customers:manage')
  const [creditMeterId, setCreditMeterId] = useState<string>()
  const { dateRange, interval } = useCustomerMetricsParams(customer)
  const { data: customerMetersData, isLoading } = useCustomerMeters(
    customer.organization_id,
    { customer_id: customer.id, sorting: ['meter_name'] },
  )

  const { data: subscriptionsData } = useSubscriptions(
    customer.organization_id,
    { customer_id: customer.id, active: true, limit: 100 },
  )

  const customerMeters = useMemo((): CustomerMeterWithSubscription[] => {
    if (!customerMetersData) return []

    const getSubscription = (meterId: string) =>
      (subscriptionsData?.items || []).find((sub) =>
        sub.meters.some((m) => m.meter_id === meterId),
      ) ?? null

    return customerMetersData.items.map((cm) => ({
      ...cm,
      subscription: getSubscription(cm.meter_id),
    }))
  }, [customerMetersData, subscriptionsData])

  const quantitiesResults = useMultipleMeterQuantities(
    customerMeters.map((cm) => ({
      id: cm.meter_id,
      customer_id: cm.customer_id,
    })),
    {
      start_timestamp: dateRange.startDate.toISOString(),
      end_timestamp: dateRange.endDate.toISOString(),
      interval,
    },
  )

  const series = useMemo(
    () =>
      customerMeters.map((cm, i) => ({
        key: cm.meter_id,
        label: cm.meter.name,
        color: METER_COLORS[i % METER_COLORS.length],
      })),
    [customerMeters],
  )

  const chartData = useMemo(() => {
    const timestampMap = new Map<string, Record<string, number | string>>()

    customerMeters.forEach((cm, i) => {
      const data = quantitiesResults[i]?.data
      if (!data) return
      data.quantities.forEach(({ timestamp, quantity }) => {
        const key = (timestamp as unknown as Date).toISOString()
        if (!timestampMap.has(key)) timestampMap.set(key, { timestamp: key })
        timestampMap.get(key)![cm.meter_id] = quantity
      })
    })

    return Array.from(timestampMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp as string).getTime() -
        new Date(b.timestamp as string).getTime(),
    )
  }, [customerMeters, quantitiesResults])

  const tableRows = useMemo(
    (): MeterRow[] =>
      customerMeters.map((cm, i) => ({
        ...cm,
        color: METER_COLORS[i % METER_COLORS.length],
        overages: getOverages(cm),
      })),
    [customerMeters],
  )

  if (!isLoading && customerMeters.length === 0) {
    return (
      <EmptyState
        icon={<GaugeCircleIcon className="h-6 w-6" />}
        title="No active meters"
        description="This customer does not have any active meters"
      />
    )
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-4 p-2">
        <div className="dark:bg-polar-900 rounded-3xl bg-white p-4">
          <Suspense fallback={<div style={{ height: 250 }} />}>
            <StackedMeterChart
              data={chartData}
              series={series}
              interval={interval}
              height={250}
            />
          </Suspense>
        </div>
      </ShadowBox>
      <DataTable
        isLoading={isLoading}
        data={tableRows}
        onRowClick={(row) =>
          router.push(
            `/dashboard/${organization.slug}/customers/${customer.id}/meter/${row.original.meter_id}`,
          )
        }
        columns={[
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Meter" />
            ),
            accessorKey: 'meter.name',
            size: 200,
            cell: ({ row }) => (
              <div className="flex items-center gap-x-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.original.color }}
                />
                <span>{row.original.meter.name}</span>
                {row.original.subscription && (
                  <span className="dark:text-polar-500 text-gray-500">
                    {row.original.subscription.product.name}
                  </span>
                )}
              </div>
            ),
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Consumed" />
            ),
            accessorKey: 'consumed_units',
            size: 110,
            cell: ({ row }) => (
              <FormattedUnits value={row.original.consumed_units} />
            ),
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Credited" />
            ),
            accessorKey: 'credited_units',
            size: 110,
            cell: ({ row }) => (
              <FormattedUnits value={row.original.credited_units} />
            ),
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Balance" />
            ),
            accessorKey: 'balance',
            size: 110,
            cell: ({ row }) => {
              const { balance } = row.original
              return (
                <span>
                  <FormattedUnits value={balance} />
                </span>
              )
            },
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Overages" />
            ),
            accessorKey: 'overages',
            size: 110,
            cell: ({ row }) => {
              const { overages } = row.original
              return overages ? (
                <span>
                  {formatCurrency('compact')(overages.cost, overages.currency)}
                </span>
              ) : (
                <span className="dark:text-polar-500 text-gray-500">—</span>
              )
            },
          },
          ...(canAddCredits
            ? [
                {
                  id: 'add_credits',
                  header: '',
                  size: 130,
                  cell: ({ row }: { row: { original: MeterRow } }) => (
                    <Box justifyContent="end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          setCreditMeterId(row.original.meter_id)
                          addCreditsModal.show()
                        }}
                      >
                        Add credits
                      </Button>
                    </Box>
                  ),
                },
              ]
            : []),
        ]}
      />
      <InlineModal
        isShown={addCreditsModal.isShown}
        hide={addCreditsModal.hide}
        modalContent={
          <AddCreditsModal
            organization={organization}
            customer={customer}
            meterId={creditMeterId}
            onClose={addCreditsModal.hide}
          />
        }
      />
    </Box>
  )
}
