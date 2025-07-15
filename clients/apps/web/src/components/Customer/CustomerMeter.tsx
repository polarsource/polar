import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import FormattedUnits from '../Meter/FormattedUnits'
import MetricChart from '../Metrics/MetricChart'

export const CustomerMeter = ({
  customerMeter,
  data: { quantities, total },
}: {
  customerMeter: schemas['CustomerMeter']
  data: ParsedMeterQuantities
}) => {
  const { meter } = customerMeter

  return (
    <ShadowBox className="dark:bg-polar-800 flex flex-col p-2">
      <div className="flex flex-col gap-y-4 p-6">
        <div className="flex flex-row items-center justify-between gap-x-2">
          <h2 className="text-xl">{meter.name}</h2>
          {/* <div className="flex flex-row items-center gap-x-4">
            <Button size="sm">View Events</Button>
            <Button size="icon" variant="secondary" className="h-8 w-8">
              <MoreVert fontSize="small" />
            </Button>
          </div> */}
        </div>
        <div className="flex flex-row items-center gap-x-8">
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Last 7 Days
            </span>
            <h3 className="text-lg">
              <FormattedUnits value={total} />
            </h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Total
            </span>
            <h3 className="text-lg">
              <FormattedUnits value={customerMeter.consumed_units} />
            </h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Credited
            </span>
            <h3 className="text-lg">
              <FormattedUnits value={customerMeter.credited_units} />
            </h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Balance
            </span>
            <h3 className="text-lg">
              <FormattedUnits value={customerMeter.balance} />
            </h3>
          </div>
        </div>
      </div>
      <div className="dark:bg-polar-900 flex flex-col justify-between gap-y-6 rounded-3xl bg-white p-4">
        <MetricChart
          data={quantities as unknown as ParsedMetricPeriod[]}
          interval="day"
          height={250}
          metric={{
            slug: 'quantity',
            display_name: 'Quantity',
            type: 'scalar',
          }}
        />
      </div>
    </ShadowBox>
  )
}
