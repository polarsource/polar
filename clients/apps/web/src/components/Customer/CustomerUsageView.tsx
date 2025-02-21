import { useMeterQuantities, useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { CustomerMeter } from './CustomerMeter'

export const CustomerUsageView = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const { data: meters } = useMeters(customer.organization_id)

  const startDate = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    [],
  )

  const endDate = useMemo(() => new Date(), [])

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-8">
        {meters?.items.map((meter) => (
          <CustomerMeterItem
            key={meter.id}
            meter={meter}
            startDate={startDate}
            endDate={endDate}
            customer={customer}
          />
        ))}
      </div>
    </TabsContent>
  )
}

const CustomerMeterItem = ({
  meter,
  startDate,
  endDate,
  customer,
}: {
  meter: schemas['Meter']
  startDate: Date
  endDate: Date
  customer: schemas['Customer']
}) => {
  const { data } = useMeterQuantities(
    meter.id,
    startDate,
    endDate,
    'day',
    customer.id,
  )

  if (!data) return null

  return <CustomerMeter key={meter.id} meter={meter} data={data} />
}
