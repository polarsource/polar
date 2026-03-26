import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMultipleMeterQuantities } from '@/hooks/queries/meters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@polar-sh/currency'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  DataTable,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
import StackedMeterChart from '../Meter/StackedMeterChart'

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
    (price): price is schemas['ProductPriceMeteredUnit'] =>
      price.amount_type === 'metered_unit' && price.meter_id === cm.meter.id,
  )
  if (!unitPrice) return null

  const overageUnits = Math.abs(cm.balance)
  const overageCost = overageUnits * parseFloat(unitPrice.unit_amount)
  return {
    cost: unitPrice.cap_amount
      ? Math.min(overageCost, unitPrice.cap_amount)
      : overageCost,
    currency: unitPrice.price_currency,
  }
}

export const CustomerUsageView = ({
  customer,
  organization,
  dateRange,
  interval,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
  dateRange: { startDate: Date; endDate: Date }
  interval: schemas['TimeInterval']
}) => {
  const router = useRouter()
  const { data: customerMetersData, isLoading } = useCustomerMeters(
    customer.organization_id,
    { customer_id: customer.id, sorting: ['meter_name'] },
  )

  const { data: subscriptionsData } = useSubscriptions(
    customer.organization_id,
    { customer_id: customer.id, active: true },
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
      <TabsContent value="usage" className="flex flex-col gap-y-8">
        <div className="flex flex-col items-center gap-y-2">
          <h3 className="text-lg font-medium">No active meters</h3>
          <p className="dark:text-polar-500 text-gray-500">
            This customer has no active meters.
          </p>
        </div>
      </TabsContent>
    )
  }

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-8">
      <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-4 p-2">
        <div className="dark:bg-polar-900 rounded-3xl bg-white p-4">
          <StackedMeterChart
            data={chartData}
            series={series}
            interval={interval}
            height={250}
          />
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
            cell: ({ row }) => (
              <FormattedUnits value={row.original.consumed_units} />
            ),
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Credited" />
            ),
            accessorKey: 'credited_units',
            cell: ({ row }) => (
              <FormattedUnits value={row.original.credited_units} />
            ),
          },
          {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Balance" />
            ),
            accessorKey: 'balance',
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
        ]}
      />
    </TabsContent>
  )
}
