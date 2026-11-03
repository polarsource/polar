'use client'

import { useEvents } from '@/hooks/queries/events'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { MeterHistory, MeterHistoryEvent } from './MeterHistory'
import { MeterPeriodEvents } from './MeterPeriodEvents'
import { CurrentPeriod, MeterPeriodSummary } from './MeterPeriodSummary'

export const MeterPeriodDetails = ({
  organization,
  customer,
  meter,
  currentPeriod,
  currentPeriodStart,
  startDate,
  endDate,
  interval,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  currentPeriod: CurrentPeriod | null
  currentPeriodStart: Date | null
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
  // customer's credits and resets on every meter; past 100 in the range, the
  // oldest are cut.
  const { data: historyData } = useEvents(organization.id, {
    name: ['meter.credited', 'meter.reset'],
    customer_id: customer.id,
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    limit: 100,
  })
  const history = useMemo(
    () =>
      (historyData?.items ?? []).filter(
        (event): event is MeterHistoryEvent =>
          (event.name === 'meter.credited' || event.name === 'meter.reset') &&
          event.metadata.meter_id === meter.id,
      ),
    [historyData, meter.id],
  )
  const credits = useMemo(
    () =>
      history.filter(
        (event): event is schemas['MeterCreditEvent'] =>
          event.name === 'meter.credited',
      ),
    [history],
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
      >
        <MeterHistory
          organization={organization}
          customer={customer}
          meterId={meter.id}
          events={history}
          currentPeriodStart={currentPeriodStart}
        />
      </MeterPeriodSummary>
      <MeterPeriodEvents
        organization={organization}
        customer={customer}
        meter={meter}
        startDate={startDate}
        endDate={endDate}
      />
    </Box>
  )
}
