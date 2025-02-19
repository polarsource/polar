import { useMeterQuantities, useMeters } from '@/hooks/queries/meters'
import { computeCumulativeValue } from '@/utils/metrics'
import { MoreVert } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { MeterChart } from '../Meter/MeterChart'

export const CustomerUsageView = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const { data: meters } = useMeters(customer.organization_id)

  return (
    <TabsContent value="usage" className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-8">
        {meters?.items.map((meter) => (
          <CustomerMeter
            key={meter.id}
            meter={meter}
            customerId={customer.id}
          />
        ))}
      </div>
    </TabsContent>
  )
}

const CustomerMeter = ({
  meter,
  customerId,
}: {
  meter: schemas['Meter']
  customerId: string
}) => {
  const startDate = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    [],
  )

  const endDate = useMemo(() => new Date(), [])

  const { data: quantities } = useMeterQuantities(
    meter.id,
    startDate,
    endDate,
    'day',
    customerId,
  )

  const periodValue = computeCumulativeValue(
    {
      slug: 'quantity',
      display_name: 'Quantity',
      type: 'scalar',
    },
    quantities?.quantities.map((q) => q.quantity) ?? [],
  )

  const formatter = Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  })

  if (!meter || !quantities) return null

  return (
    <ShadowBox className="flex flex-row gap-x-8 p-4">
      <div className="dark:bg-polar-800 flex w-full max-w-xs flex-col justify-between gap-y-6 rounded-3xl bg-white p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center gap-x-4">
            <h2 className="text-xl">{meter.name}</h2>
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Last 7 Days
            </span>
            <h3 className="text-xl">{formatter.format(periodValue)}</h3>
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Overage
            </span>
            <h3 className="text-xl">—</h3>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <Button>View Events</Button>
          <Button size="icon" variant="secondary" className="h-8 w-8">
            <MoreVert fontSize="small" />
          </Button>
        </div>
      </div>
      <MeterChart data={quantities.quantities} interval="day" />
    </ShadowBox>
  )
}
