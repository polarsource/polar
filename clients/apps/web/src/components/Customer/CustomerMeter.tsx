import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useMemo } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
import MetricChart from '../Metrics/MetricChart'

export const CustomerMeter = ({
  customerMeter,
  data: { quantities },
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

  const creditProgress = useMemo(() => {
    if (customerMeter.credited_units <= 0) return null
    const pct = Math.min(
      1,
      customerMeter.consumed_units / customerMeter.credited_units,
    )
    return { pct }
  }, [customerMeter.consumed_units, customerMeter.credited_units])

  return (
    <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-6 p-8">
      <div className="flex flex-row items-start justify-between gap-x-4">
        <div className="flex flex-col gap-y-1">
          {customerMeter.subscription && (
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {customerMeter.subscription.product.name}
            </span>
          )}
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {meter.name}
          </h2>
          {customerMeter.subscription && (
            <span className="dark:text-polar-400 text-sm text-gray-500">
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
                  {' until upgrade'}
                </>
              )}
            </span>
          )}
        </div>
        {unitPrice && (
          <div className="flex flex-col items-end gap-y-1">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Overages
            </span>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency('compact')(
                overages || 0,
                unitPrice.price_currency,
              )}
            </span>
          </div>
        )}
      </div>

      {creditProgress && (
        <div className="flex flex-col gap-y-2">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
              style={{ width: `${creditProgress.pct * 100}%` }}
            />
          </div>
          <span className="dark:text-polar-400 text-right text-sm text-gray-500">
            <FormattedUnits value={customerMeter.consumed_units} /> of{' '}
            <FormattedUnits value={customerMeter.credited_units} /> credits used
          </span>
        </div>
      )}

      <div className="dark:bg-polar-900 -mx-2 rounded-3xl bg-white p-4">
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
