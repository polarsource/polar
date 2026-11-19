import { CondensedTable } from '@/components/Shared/CondensedTable'
import { schemas } from '@polar-sh/client'
import { EventLogCompactRow, eventLogColumns } from './EventLogRow'

export const EventLog = ({
  events,
  selectedEventId,
  onSelect,
  onStep,
  onClose,
}: {
  events: schemas['Event'][]
  selectedEventId: string | null
  onSelect: (id: string) => void
  onStep: (id: string) => void
  onClose: () => void
}) => (
  <CondensedTable
    columns={eventLogColumns}
    rows={events}
    getRowId={(event) => event.id}
    selectedId={selectedEventId}
    onSelect={onSelect}
    onStep={onStep}
    onClose={onClose}
    renderCompact={(event) => <EventLogCompactRow event={event} />}
  />
)
