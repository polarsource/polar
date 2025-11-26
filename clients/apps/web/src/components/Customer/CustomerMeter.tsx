import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
import MetricChart from '../Metrics/MetricChart'

export const CustomerMeter = ({
  customerMeter,
  data: { quantities, total },
}: {
  customerMeter: schemas['CustomerMeter'] & {
    subscription: schemas['Subscription'] | null
  }
  data: ParsedMeterQuantities
}) => {
  const { meter } = customerMeter

  const unitPrice = customerMeter.subscription?.product.prices.find(
    (price): price is schemas['ProductPriceMeteredUnit'] =>
      price.amount_type === 'metered_unit' && price.meter_id === meter.id,
  )

  const overages = useMemo(() => {
    if (!unitPrice) {
      return null
    }

    if (customerMeter.balance >= 0) {
      return null
    }

    const overageUnits = Math.abs(customerMeter.balance)
    const overageCost = overageUnits * parseFloat(unitPrice.unit_amount)

    if (unitPrice.cap_amount) {
      return Math.min(overageCost, unitPrice.cap_amount)
    }

    return overageCost
  }, [customerMeter.balance, unitPrice])

  return (
    <ShadowBox className="dark:bg-polar-800 flex flex-col p-2">
      <div className="mb-2 flex flex-row items-center justify-between gap-x-2 p-6">
        <h2 className="text-xl">{meter.name}</h2>
        <span className="text-xl">
          <FormattedUnits value={total} />
        </span>
      </div>
      {customerMeter.subscription && (
        <div className="-mt-2 mb-6 flex flex-row flex-wrap items-start gap-x-8 gap-y-2 rounded-2xl px-6">
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Subscription
            </span>
            <h3 className="text-lg">
              {customerMeter.subscription.product.name}
            </h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Current billing period
            </span>
            <h3 className="text-lg">
              {customerMeter.subscription.current_period_end ? (
                <FormattedInterval
                  startDatetime={
                    customerMeter.subscription.current_period_start
                  }
                  endDatetime={customerMeter.subscription.current_period_end}
                />
              ) : (
                <>
                  <FormattedDateTime
                    datetime={customerMeter.subscription.current_period_start}
                  />
                  until upgrade
                </>
              )}
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
              <FormattedUnits value={Math.abs(customerMeter.balance)} />
              {customerMeter.balance > 0 && (
                <span className="dark:text-polar-500 ml-1 text-xs text-gray-500">
                  credits remaining
                </span>
              )}
            </h3>
          </div>
          <div className="flex flex-col">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Overages
            </span>
            <h3 className="text-lg">
              {unitPrice &&
                formatCurrencyAndAmount(
                  overages || 0,
                  unitPrice.price_currency,
                  2,
                  'compact',
                )}
            </h3>
          </div>
        </div>
      )}
      <div className="dark:bg-polar-900 rounded-3xl bg-white p-4">
        <MetricChart
          data={quantities as unknown as ParsedMetricPeriod[]}
          interval="day"
          height={250}
          metric={{
            slug: 'quantity',
            display_name: meter.name,
            type: 'scalar',
          }}
          showYAxis
          chartType={meter.aggregation.func === 'count' ? 'bar' : 'line'}
        />
      </div>
    </ShadowBox>
  )
}
