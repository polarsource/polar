import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { CustomerMeter } from './CustomerMeter'

export const CustomerUsageView = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const { data, isLoading } = useCustomerMeters(customer.organization_id, {
    customer_id: customer.id,
    sorting: ['meter_name'],
  })
  const customerMeters = useMemo(() => data?.items || [], [data])

  const startDate = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    [],
  )
  const endDate = useMemo(() => new Date(), [])

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-8">
        {customerMeters.map((customerMeter) => (
          <CustomerMeterItem
            key={customerMeter.id}
            customerMeter={customerMeter}
            startDate={startDate}
            endDate={endDate}
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
}: {
  customerMeter: schemas['CustomerMeter']
  startDate: Date
  endDate: Date
}) => {
  const { data } = useMeterQuantities(customerMeter.meter_id, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    interval: 'day',
    customer_id: customerMeter.customer_id,
  })

  if (!data) return null

  return <CustomerMeter customerMeter={customerMeter} data={data} />
}
