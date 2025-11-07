import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { CustomerMeter } from './CustomerMeter'

export const CustomerUsageView = ({
  customer,
  dateRange,
  interval,
}: {
  customer: schemas['Customer']
  dateRange: { startDate: Date; endDate: Date }
  interval: schemas['TimeInterval']
}) => {
  const { data: customerMetersData, isLoading } = useCustomerMeters(
    customer.organization_id,
    {
      customer_id: customer.id,
      sorting: ['meter_name'],
    },
  )

  const { data: subscriptionsData } = useSubscriptions(
    customer.organization_id,
    {
      customer_id: customer.id,
      active: true,
    },
  )

  const customerMeters = useMemo(() => {
    if (!customerMetersData) {
      return []
    }

    const getSubscriptionForMeter = (meterId: string) => {
      return (subscriptionsData?.items || []).find((subscription) =>
        subscription.meters.some((meter) => meter.meter_id === meterId),
      )
    }

    return customerMetersData.items.map((customerMeter) => {
      const subscription = getSubscriptionForMeter(customerMeter.meter_id)

      return {
        ...customerMeter,
        subscription: subscription || null,
      }
    })
  }, [customerMetersData, subscriptionsData])

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-8">
        {customerMeters.map((customerMeter) => (
          <CustomerMeterItem
            key={customerMeter.id}
            customerMeter={customerMeter}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            interval={interval}
          />
        ))}
        {!isLoading && customerMeters.length === 0 && (
          <div className="flex flex-col items-center gap-y-6">
            <div className="flex flex-col items-center gap-y-2">
              <h3 className="text-lg font-medium">No active meter</h3>
              <p className="dark:text-polar-500 text-gray-500">
                This customer has no active meters.
              </p>
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  )
}

const CustomerMeterItem = ({
  customerMeter,
  startDate,
  endDate,
  interval,
}: {
  customerMeter: schemas['CustomerMeter'] & {
    subscription: schemas['Subscription'] | null
  }
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
}) => {
  const { data } = useMeterQuantities(customerMeter.meter_id, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    interval,
    customer_id: customerMeter.customer_id,
  })

  if (!data) {
    return null
  }

  return <CustomerMeter customerMeter={customerMeter} data={data} />
}
