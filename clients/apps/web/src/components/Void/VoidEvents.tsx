import { Box } from '@polar-sh/orbit/Box'
import { VoidCatalogEvent } from './events'
import { VoidEventRow } from './VoidEventRow'

export const VoidEvents = ({
  events,
  base,
  identityNames,
}: {
  events: VoidCatalogEvent[]
  base: string
  identityNames: Map<string, string>
}) => (
  <Box flexDirection="column" rowGap="m">
    {events.map((event) => (
      <VoidEventRow
        key={event.id}
        event={event}
        base={base}
        identityNames={identityNames}
      />
    ))}
  </Box>
)
