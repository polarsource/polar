import { useMeters } from '@/hooks/queries/meters'
import { Customer, Meter } from '@polar-sh/api'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'

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
  // const { data } = useMeterEvents(meter.id)
  // const meterEvents = useMemo(() => {
  //   if (!data) return []
  //   return data.pages.flatMap((page) => page.items)
  // }, [data])

  // const mockedMeterData = Array.from({ length: 7 }, (_, i) => {
  //   const date = new Date()
  //   date.setDate(date.getDate() - i)
  //   return {
  //     timestamp: date,
  //     usage:
  //       meterEvents
  //         .filter((event) => {
  //           const eventDate = new Date(event.timestamp)
  //           return eventDate.toDateString() === date.toDateString()
  //         })
  //         .reduce((total: number, event) => total + event.value, 0) ?? 0,
  //   }
  // }).reverse()

  if (!meter) return null

  return null

  // return (
  //   <ShadowBox className="flex flex-row gap-x-8 p-4">
  //     <div className="dark:bg-polar-800 flex w-full max-w-xs flex-col justify-between gap-y-6 rounded-3xl bg-white p-8">
  //       <div className="flex flex-col gap-y-4">
  //         <div className="flex flex-row items-center gap-x-4">
  //           <h2 className="text-xl">{meter.name}</h2>
  //         </div>
  //         <div className="flex flex-col gap-y-1">
  //           <span className="dark:text-polar-500 text-sm text-gray-500">
  //             Last 7 Days
  //           </span>
  //           <h3 className="text-xl">{meter.value}</h3>
  //         </div>
  //         <div className="flex flex-col gap-y-1">
  //           <span className="dark:text-polar-500 text-sm text-gray-500">
  //             Credits Remaining
  //           </span>
  //           <h3 className="text-xl">{Math.max(0, 100 - meter.value)}</h3>
  //         </div>
  //         <div className="flex flex-col gap-y-1">
  //           <span className="dark:text-polar-500 text-sm text-gray-500">
  //             Overage
  //           </span>
  //           <h3 className="text-xl">
  //             <AmountLabel amount={0} currency="USD" />
  //           </h3>
  //         </div>
  //       </div>
  //       <div className="flex flex-row items-center gap-x-2">
  //         <Button>View Events</Button>
  //         <Button variant="ghost">Revoke Access</Button>
  //       </div>
  //     </div>
  //     <MeterChart
  //       data={mockedMeterData}
  //       interval={TimeInterval.DAY}
  //       metric={{
  //         display_name: 'Usage',
  //         slug: 'usage',
  //         type: MetricType.SCALAR,
  //       }}
  //     />
  //   </ShadowBox>
  // )
}
