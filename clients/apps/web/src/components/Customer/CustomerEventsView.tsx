import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { endOfToday } from 'date-fns'
import { parseAsIsoDateTime, parseAsString, useQueryState } from 'nuqs'
import { Events } from '../Events/Events'
import EventSelect from '../Events/EventSelect'
import MeterSelect from '../Meter/MeterSelect'
import DateRangePicker from '../Metrics/DateRangePicker'

export const CustomerEventsView = ({
  customer,
  organization,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
}) => {
  const [meterId, setMeterId] = useQueryState(
    'meterId',
    parseAsString.withDefault('all'),
  )
  const [eventName, setEventName] = useQueryState(
    'eventName',
    parseAsString.withDefault('all'),
  )
  const [startTimestamp, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(new Date(organization.created_at)),
  )
  const [endTimestamp, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(endOfToday()),
  )

  const {
    data: events,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(customer.organization_id, {
    limit: 50,
    customer_id: customer.id,
    ...(meterId !== 'all' ? { meter_id: meterId } : {}),
    ...(eventName !== 'all' ? { name: eventName } : {}),
    ...(startTimestamp
      ? { start_timestamp: startTimestamp.toISOString() }
      : {}),
    ...(endTimestamp ? { end_timestamp: endTimestamp.toISOString() } : {}),
  })

  return (
    <TabsContent value="events" className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-4 md:flex-row md:gap-x-6">
        <DateRangePicker
          className="w-auto min-w-64"
          date={{
            from: startTimestamp
              ? new Date(startTimestamp)
              : new Date(organization.created_at),
            to: endTimestamp ? new Date(endTimestamp) : new Date(),
          }}
          onDateChange={(date) => {
            if (date.from) {
              setStartDate(date.from)
            } else {
              setStartDate(null)
            }
            if (date.to) {
              setEndDate(date.to)
            } else {
              setEndDate(null)
            }
          }}
        />
        <EventSelect
          className="w-auto min-w-64"
          organizationId={customer.organization_id}
          allOption
          value={eventName}
          onValueChange={(eventName) => {
            if (eventName === 'all') {
              setEventName(null)
            } else {
              setEventName(eventName)
            }
          }}
        />
        <MeterSelect
          className="w-auto min-w-64"
          organizationId={customer.organization_id}
          allOption
          value={meterId}
          onValueChange={(meterId) => {
            if (meterId === 'all') {
              setMeterId(null)
            } else {
              setMeterId(meterId)
            }
          }}
        />
      </div>
      <Events
        events={events?.pages.flatMap((page) => page.items) ?? []}
        organization={organization}
      />
      {hasNextPage && (
        <Button
          className="self-start"
          variant="secondary"
          onClick={() => fetchNextPage()}
          loading={isFetching}
          disabled={!hasNextPage}
        >
          Load More
        </Button>
      )}
    </TabsContent>
  )
}
