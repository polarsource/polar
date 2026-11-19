import { CondensedTableSkeleton } from '@/components/Shared/CondensedTable'
import { eventLogColumns } from './EventLogRow'

export const EventLogSkeleton = () => (
  <CondensedTableSkeleton columns={eventLogColumns} compact />
)
