import { getNextValidInterval } from '@/components/Metrics/IntervalPicker'
import { useEvents } from '@/hooks/queries/events'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { getCustomerActivityStart } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { useMemo, useState } from 'react'

export interface MeterPeriod {
  start: Date
  end: Date | null
  current: boolean
}

const HOUR_MS = 60 * 60 * 1000

export const useMeterPeriods = ({
  organization,
  customer,
  meter,
  subscription,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  subscription: schemas['Subscription'] | null
}): MeterPeriod[] => {
  // shortcut: only the 100 most recent resets become periods, page through them if customers outgrow it
  const { data } = useEvents(organization.id, {
    name: 'meter.reset',
    customer_id: customer.id,
    metadata: { meter_id: meter.id },
    limit: 100,
  })

  return useMemo(() => {
    const resets = (data?.items ?? [])
      .map((event) => new Date(event.timestamp))
      .sort((a, b) => b.getTime() - a.getTime())
    const activityStart = getCustomerActivityStart(customer)
    const subscriptionStart = subscription
      ? new Date(subscription.current_period_start)
      : null
    // The renewal's meter reset can land just before the recorded period start.
    const renewalReset =
      subscriptionStart &&
      resets.find(
        (reset) =>
          Math.abs(reset.getTime() - subscriptionStart.getTime()) < HOUR_MS,
      )
    const currentStart =
      renewalReset ?? subscriptionStart ?? resets[0] ?? activityStart

    const periods: MeterPeriod[] = [
      {
        start: currentStart,
        end: subscription?.current_period_end
          ? new Date(subscription.current_period_end)
          : null,
        current: true,
      },
    ]
    let end = currentStart
    for (const reset of resets.filter((reset) => reset < currentStart)) {
      periods.push({ start: reset, end, current: false })
      end = reset
    }
    if (activityStart < end) {
      periods.push({ start: activityStart, end, current: false })
    }
    return periods
  }, [data, customer, subscription])
}

export const useMeterPeriodUsage = ({
  organization,
  customer,
  meter,
  period,
  customerMeter,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  period: MeterPeriod
  customerMeter: schemas['CustomerMeter'] | null
}) => {
  const [now] = useState(() => new Date())
  const start = period.start
  const end = period.end ?? now
  const interval = getNextValidInterval('day', start, end)

  // shortcut: a period with more than 100 credits shows only the latest 100
  const { data: creditsData } = useEvents(organization.id, {
    name: 'meter.credited',
    customer_id: customer.id,
    metadata: { meter_id: meter.id },
    start_timestamp: start.toISOString(),
    end_timestamp: end.toISOString(),
    limit: 100,
  })
  const { data: quantities } = useMeterQuantities(meter.id, {
    start_timestamp: start.toISOString(),
    end_timestamp: end.toISOString(),
    interval,
    customer_id: customer.id,
  })

  const credits = (creditsData?.items ?? []).filter(
    (event): event is schemas['MeterCreditEvent'] =>
      event.name === 'meter.credited',
  )
  const sumUnits = (events: schemas['MeterCreditEvent'][]) =>
    events.reduce((sum, event) => sum + event.metadata.units, 0)

  // The customer meter is the source of truth for the running period.
  const live = period.current ? customerMeter : null
  const credited = live?.credited_units ?? sumUnits(credits)
  const used = live?.consumed_units ?? quantities?.total ?? 0
  const manualCredited = sumUnits(
    credits.filter((credit) => credit.metadata.reason === 'manual'),
  )

  return {
    interval,
    quantities,
    credits,
    credited,
    manualCredited,
    used,
    balance: live?.balance ?? credited - used,
  }
}
