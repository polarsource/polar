import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { parseAsString, useQueryState } from 'nuqs'
import { Events } from '../Events/Events'
import EventSelect from '../Events/EventSelect'
import MeterSelector from '../Meter/MeterSelector'
import { EmptyState } from '../CustomerPortal/EmptyState'
import ShortTextOutlined from '@mui/icons-material/ShortTextOutlined'

export const CustomerEventsView = ({
  customer,
  organization,
  dateRange,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
  dateRange: { startDate: Date; endDate: Date }
}) => {
  const [meterId, setMeterId] = useQueryState('meterId', parseAsString)
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
    ...(meterId ? { meter_id: meterId } : {}),
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
        <MeterSelector
          className="min-w-64"
          organizationId={customer.organization_id}
          value={meterId}
          onChange={setMeterId}
          placeholder="All Meters"
        />
      </div>
      {events?.pages.flatMap((page) => page.items).length === 0 ? (
        <EmptyState
          icon={<ShortTextOutlined fontSize="medium" />}
          title="No events found"
          description="There are no events matching the current filters"
        />
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
