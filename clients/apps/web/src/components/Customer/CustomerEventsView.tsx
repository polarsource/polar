import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { parseAsString, useQueryState } from 'nuqs'
import { Events } from '../Events/Events'
import EventSelect from '../Events/EventSelect'
import MeterSelect from '../Meter/MeterSelect'

export const CustomerEventsView = ({
  customer,
  organization,
  dateRange,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
  dateRange: { startDate: Date; endDate: Date }
}) => {
  const [meterId, setMeterId] = useQueryState(
    'meterId',
    parseAsString.withDefault('all'),
  )
  const [eventName, setEventName] = useQueryState(
    'eventName',
    parseAsString.withDefault('all'),
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
    ...(dateRange?.startDate
      ? { start_timestamp: dateRange.startDate.toISOString() }
      : {}),
    ...(dateRange?.endDate
      ? { end_timestamp: dateRange?.endDate.toISOString() }
      : {}),
  })

  return (
    <TabsContent value="events" className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-4 md:flex-row md:gap-x-6">
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
      {events?.pages.flatMap((page) => page.items).length === 0 ? (
        <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
          <h1 className="text-2xl font-normal">No Events Found</h1>
          <p className="dark:text-polar-500 text-gray-500">
            There are no events matching your current filters
          </p>
        </div>
      ) : (
        <Events
          events={events?.pages.flatMap((page) => page.items) ?? []}
          organization={organization}
        />
      )}
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
