'use client'

import { CreditHistory } from '@/components/Customer/CreditHistory/CreditHistory'
import { useEvents } from '@/hooks/queries/events'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { MeterPeriodEvents } from './MeterPeriodEvents'
import { CurrentPeriod, MeterPeriodSummary } from './MeterPeriodSummary'

export const MeterPeriodDetails = ({
  organization,
  customer,
  meter,
  currentPeriod,
  startDate,
  endDate,
  interval,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  currentPeriod: CurrentPeriod | null
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
}) => {
  const { data: quantities } = useMeterQuantities(meter.id, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    interval,
    customer_id: customer.id,
  })
  // Events search can't filter system events by meter, so this fetches the
  // customer's credits on every meter; past 100 in the range, the oldest are cut.
  const { data: creditsData } = useEvents(organization.id, {
    name: 'meter.credited',
    customer_id: customer.id,
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    limit: 100,
  })
  const credits = useMemo(
    () =>
      (creditsData?.items ?? []).filter(
        (event): event is schemas['MeterCreditEvent'] =>
          event.name === 'meter.credited' &&
          event.metadata.meter_id === meter.id,
      ),
    [creditsData, meter.id],
  )

  return (
    <Box flexDirection="column" rowGap="3xl">
      <MeterPeriodSummary
        organization={organization}
        meter={meter}
        currentPeriod={currentPeriod}
        quantities={quantities}
        credits={credits}
        startDate={startDate}
        endDate={endDate}
        interval={interval}
      />
      <CreditHistory credits={credits} />
      <MeterPeriodEvents
        key={`${startDate.toISOString()}-${endDate.toISOString()}`}
        organization={organization}
        customer={customer}
        meter={meter}
        startDate={startDate}
        endDate={endDate}
      />
    </Box>
  )
}
