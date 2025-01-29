import { Interval, MetricType } from '@polar-sh/api'

import { Meter, MeterEvent } from '@/app/api/meters/data'
import { MeterChart } from '@/components/Meter/MeterChart'
import { useMeterEvents, useMeters } from '@/hooks/queries/meters'
import { Customer } from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { twMerge } from 'tailwind-merge'
import AmountLabel from '../Shared/AmountLabel'

export const CustomerUsageView = ({ customer }: { customer: Customer }) => {
  const { data: meters } = useMeters(customer.organization_id)

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-8">
        {meters?.items.map((meter) => (
          <CustomerMeter key={meter.id} meter={meter} />
        ))}
      </div>
    </TabsContent>
  )
}

const CustomerMeter = ({ meter }: { meter: Meter }) => {
  const { data: meterEvents } = useMeterEvents(meter?.slug)

  const mockedMeterData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return {
      timestamp: date,
      usage:
        meterEvents?.items
          .filter((event: MeterEvent) => {
            const eventDate = new Date(event.created_at)
            return eventDate.toDateString() === date.toDateString()
          })
          .reduce(
            (total: number, event: MeterEvent) => total + event.value,
            0,
          ) ?? 0,
    }
  }).reverse()

  if (!meter) return null

  return (
    <ShadowBox className="flex flex-row gap-x-8 p-4">
      <div className="dark:bg-polar-800 flex w-full max-w-xs flex-col justify-between gap-y-6 rounded-3xl bg-white p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center gap-x-4">
            <h2 className="text-xl">{meter.name}</h2>
            <Status
              className={twMerge(
                'w-fit capitalize',
                meter?.status === 'active'
                  ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                  : 'bg-red-100 text-red-500 dark:bg-red-950',
              )}
              status={meter?.status}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Last 7 Days
            </span>
            <h3 className="text-xl">{meter.value}</h3>
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Credits Remaining
            </span>
            <h3 className="text-xl">{Math.max(0, 100 - meter.value)}</h3>
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Overage
            </span>
            <h3 className="text-xl">
              <AmountLabel amount={0} currency="USD" />
            </h3>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <Button>View Events</Button>
          <Button variant="ghost">Revoke Access</Button>
        </div>
      </div>
      <MeterChart
        data={mockedMeterData}
        interval={Interval.DAY}
        metric={{
          display_name: 'Usage',
          slug: 'usage',
          type: MetricType.SCALAR,
        }}
      />
    </ShadowBox>
  )
}
