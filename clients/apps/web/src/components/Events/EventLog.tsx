import {
  CondensedTable,
  CondensedTableHeader,
  CondensedTableSkeleton,
  useCondensedTable,
  type CondensedTableInstance,
} from '@/components/Shared/CondensedTable'
import { schemas } from '@polar-sh/client'
import { EventLogCompactRow, eventLogColumns } from './EventLogRow'

type EventLogTable = CondensedTableInstance<schemas['Event']>

export const useEventLogTable = (events: schemas['Event'][]): EventLogTable =>
  useCondensedTable({
    columns: eventLogColumns,
    rows: events,
    getRowId: (event) => event.id,
  })

export const EventLogHeader = ({ table }: { table: EventLogTable }) => (
  <CondensedTableHeader table={table} compact />
)

export const EventLogSkeleton = ({ table }: { table: EventLogTable }) => (
  <CondensedTableSkeleton table={table} compact />
)

export const EventLog = ({
  table,
  selectedEventId,
  onSelect,
  onStep,
  onClose,
}: {
  table: EventLogTable
  selectedEventId: string | null
  onSelect: (id: string) => void
  onStep: (id: string) => void
  onClose: () => void
}) => (
  <CondensedTable
    table={table}
    selectedId={selectedEventId}
    onSelect={onSelect}
    onStep={onStep}
    onClose={onClose}
    renderCompact={(event) => <EventLogCompactRow event={event} />}
  />
)
