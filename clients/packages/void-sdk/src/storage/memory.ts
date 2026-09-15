import type { EventStorage, StoredEvent } from './storage'

/**
 * Reference ledger held in process memory. It documents the storage contract
 * in the simplest terms and suits tests; it shares nothing across processes.
 */
export function memoryEventStorage(): EventStorage & {
  /** Every stored event, rejected ones included, for inspection. */
  readonly rows: () => StoredEvent[]
} {
  const events = new Map<string, StoredEvent>()
  const rejected = new Set<string>()
  const key = (organizationId: string, externalId: string) =>
    JSON.stringify([organizationId, externalId])
  return {
    type: 'memory',
    rows: () => [...events.values()],
    persist(organizationId, batch, { pruneBefore } = {}) {
      // Validate the whole batch before touching state, so a failure stores nothing.
      const prepared = batch.map((event): StoredEvent => {
        const at = new Date(event.timestamp)
        if (Number.isNaN(at.getTime()))
          throw new Error(`void: invalid timestamp for ${event.external_id}`)
        return {
          ...event,
          metadata: JSON.parse(JSON.stringify(event.metadata)),
          timestamp: at.toISOString(),
          organization_id: organizationId,
          recorded_at: new Date().toISOString(),
        }
      })
      if (pruneBefore) {
        for (const [id, event] of events)
          if (
            event.organization_id === organizationId &&
            Date.parse(event.recorded_at) < pruneBefore.getTime()
          )
            events.delete(id)
        for (const id of rejected)
          if (JSON.parse(id)[0] === organizationId && !events.has(id))
            rejected.delete(id)
      }
      return prepared.map((event) => {
        const id = key(organizationId, event.external_id)
        rejected.delete(id)
        const stored = events.get(id) ?? event
        events.set(id, stored)
        const { organization_id: _org, recorded_at: _at, ...copy } = stored
        return copy
      })
    },
    reject(organizationId, batch) {
      for (const event of batch)
        rejected.add(key(organizationId, event.external_id))
    },
    forget(organizationId, externalIds) {
      for (const externalId of externalIds) {
        events.delete(key(organizationId, externalId))
        rejected.delete(key(organizationId, externalId))
      }
    },
    read(organizationId, { names, identities, since, until, recordedSince }) {
      if (!names.length || !identities.length) return []
      return [...events.values()]
        .filter(
          (event) =>
            event.organization_id === organizationId &&
            !rejected.has(key(organizationId, event.external_id)) &&
            names.includes(event.name) &&
            event.external_identity_id !== null &&
            identities.includes(event.external_identity_id) &&
            (since === null ||
              Date.parse(event.timestamp) >= since.getTime()) &&
            Date.parse(event.timestamp) <= until.getTime() &&
            (recordedSince === null ||
              Date.parse(event.recorded_at) >= recordedSince.getTime()),
        )
        .sort(
          (a, b) =>
            a.timestamp.localeCompare(b.timestamp) ||
            a.external_id.localeCompare(b.external_id),
        )
        .map((event) => ({
          ...event,
          metadata: structuredClone(event.metadata),
        }))
    },
  }
}
