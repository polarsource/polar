import { EventRow } from '@/components/Events/EventRow'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { toPolarEvent, VoidCatalogEvent } from './events'

export const VoidEvents = ({
  events,
  organization,
}: {
  events: VoidCatalogEvent[]
  organization: schemas['Organization']
}) => (
  <Box flexDirection="column" rowGap="m">
    {events.map((event) => (
      <EventRow
        key={event.id}
        event={toPolarEvent(event, organization.id)}
        organization={organization}
        renderChildren={false}
        renderEventLink={false}
      />
    ))}
  </Box>
)
