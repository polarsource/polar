import type { CustomerState } from '../api/generated'
import type { StoredEvent } from './storage'
import { matches } from './reducers'

export function eventIncluded(
  snapshot: CustomerState,
  event: StoredEvent,
): boolean {
  if (event.organization_id !== snapshot.organization_id) return false
  const reducers = snapshot.reducers.filter(
    (r) => r.filter && matches(r.filter, event, snapshot.customer.external_id),
  )
  return (
    reducers.length > 0 &&
    reducers.every((r) =>
      snapshot.buckets.some(
        (b) =>
          b.reducer_id === r.id &&
          b.external_identity_id === event.external_identity_id &&
          b.last_processed_event?.event_ids.includes(event.external_id),
      ),
    )
  )
}

/** Tells signal listeners that this client wrote local events, or withdrew rejected ones. */
export class EventChanges {
  private readonly listeners = new Set<(rejected: boolean) => void>()

  subscribe(listener: (rejected: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(rejected: boolean): void {
    for (const listener of this.listeners) listener(rejected)
  }
}
