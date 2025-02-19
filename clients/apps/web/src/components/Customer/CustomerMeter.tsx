import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { computeCumulativeValue } from '@/utils/metrics'
import { MoreVert } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { MeterChart } from '../Meter/MeterChart'

export const CustomerMeter = ({
  meter,
  data: { quantities },
}: {
  meter: schemas['Meter']
  data: ParsedMeterQuantities
}) => {
  const periodValue = computeCumulativeValue(
    {
      slug: 'quantity',
      display_name: 'Quantity',
      type: 'scalar',
    },
    quantities.map((q) => q.quantity) ?? [],
  )

  const formatter = Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  })

  if (!meter || !quantities) return null

  return (
    <ShadowBox className="flex flex-col p-2">
      <div className="flex flex-col gap-y-4 p-6">
        <div className="flex flex-row items-center justify-between gap-x-2">
          <h2 className="text-xl">{meter.name}</h2>
          <div className="flex flex-row items-center gap-x-4">
            <Button size="sm">View Events</Button>
            <Button size="icon" variant="secondary" className="h-8 w-8">
              <MoreVert fontSize="small" />
            </Button>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-8">
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Last 7 Days
            </span>
            <h3 className="text-lg">{formatter.format(periodValue)}</h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Overage
            </span>
            <h3 className="text-lg">$0.00</h3>
          </div>
        </div>
      </div>
      <div className="dark:bg-polar-800 flex flex-col justify-between gap-y-6 rounded-3xl bg-white p-4">
        <MeterChart data={quantities} interval="day" height={250} />
      </div>
    </ShadowBox>
  )
}
