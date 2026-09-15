import type { EventCreate } from '../api/generated'
import type { SQLiteConnection } from './sqlite'

/** SDK-owned event envelope, with decoded JSON metadata and ISO timestamps. */
export type StoredEvent = Required<EventCreate> & {
  readonly organization_id: string
  readonly recorded_at: string
}

/** An inclusive event-time window over a set of event names and identities. */
export interface EventRange {
  readonly names: readonly string[]
  readonly identities: readonly string[]
  /** Null reads from the beginning of the ledger. */
  readonly since: Date | null
  readonly until: Date
  /** Only events recorded locally at or after this instant; null reads them all. */
  readonly recordedSince: Date | null
}

export interface PersistOptions {
  /** Events recorded locally before this instant are deleted in the same write. */
  readonly pruneBefore?: Date
}

/**
 * A local buffer that must hold every event before the API accepts it, so
 * checks and balances see this client's writes before the server has
 * processed them. It is not an archive: the server is the source of truth,
 * and an event leaves the buffer once a server receipt proves it was counted,
 * or after the configured retention. Adapters may return synchronously or
 * with a promise.
 *
 * Contract, exercised by `test/event-storage.conformance.ts`. Errors and
 * synchronous throws surface as `VoidError` with reason `event_storage`.
 * - `persist` is atomic per batch and idempotent on (organization, external_id).
 *   The first writer wins: a later batch with a different copy of the same id
 *   leaves the stored copy untouched and returns it, so callers can detect
 *   drift. Persisting an id clears an earlier rejection of it. With
 *   `pruneBefore`, the same write deletes the organization's events recorded
 *   before that instant and any rejection marks left without an event.
 * - `reject` marks server-rejected ids so that reads exclude them. It is
 *   idempotent and may name ids that were never stored.
 * - `forget` deletes the named events and their rejection marks. Idempotent.
 * - `read` returns the organization's events inside the range, rejected ids
 *   excluded, ordered by (timestamp, external_id), with ISO timestamps.
 *   An empty name or identity list reads nothing.
 */
export interface EventStorage {
  /** Backend name, for error messages. */
  readonly type: string
  persist(
    organizationId: string,
    events: readonly Required<EventCreate>[],
    options?: PersistOptions,
  ): Required<EventCreate>[] | Promise<Required<EventCreate>[]>
  forget(
    organizationId: string,
    externalIds: readonly string[],
  ): void | Promise<void>
  reject(
    organizationId: string,
    events: readonly Required<EventCreate>[],
  ): void | Promise<void>
  read(
    organizationId: string,
    range: EventRange,
  ): StoredEvent[] | Promise<StoredEvent[]>
}

/** Shorthand for the built-in SQLite adapter: a caller-owned node:sqlite connection. */
export interface SQLiteEventStorageInput {
  readonly type: 'sqlite'
  /** Must not be in an application transaction when recording an event. */
  readonly connection: SQLiteConnection
}

export type EventStorageInput = EventStorage | SQLiteEventStorageInput
