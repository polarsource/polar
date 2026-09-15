import type { DatabaseSync } from 'node:sqlite'
import { Schema } from 'effect'
import { EventCreate } from '../api/generated'
import type { EventStorage, PersistOptions, StoredEvent } from './storage'

/** A caller-owned node:sqlite DatabaseSync connection. */
export type SQLiteConnection = Pick<DatabaseSync, 'exec' | 'prepare'>

export interface SQLiteEventStorage extends EventStorage {
  readonly type: 'sqlite'
  readonly connection: SQLiteConnection
}

/**
 * Embedded ledger on a caller-owned connection. The connection must not be in
 * an application transaction when an event is recorded. SDK tables are created
 * on first write; reads of a database without them return nothing.
 */
export function sqliteEventStorage(
  connection: SQLiteConnection,
): SQLiteEventStorage {
  return {
    type: 'sqlite',
    connection,
    persist: (organizationId, events, options) =>
      persistSQLiteEvents(connection, organizationId, events, options),
    reject: (organizationId, events) =>
      rejectSQLiteEvents(connection, organizationId, events),
    forget: (organizationId, externalIds) =>
      forgetSQLiteEvents(connection, organizationId, externalIds),
    read: (
      organizationId,
      { names, identities, since, until, recordedSince },
    ) =>
      readSQLiteEvents(
        connection,
        organizationId,
        names,
        identities,
        since,
        until,
        recordedSince,
      ),
  }
}

export const sqliteEventStorageSchema = `
CREATE TABLE IF NOT EXISTS polar_void_events (
  organization_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  external_identity_id TEXT,
  timestamp TEXT NOT NULL,
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, external_id)
) STRICT;
CREATE INDEX IF NOT EXISTS polar_void_events_identity_timestamp_idx
  ON polar_void_events (organization_id, external_identity_id, timestamp);
CREATE INDEX IF NOT EXISTS polar_void_events_name_timestamp_idx
  ON polar_void_events (organization_id, name, timestamp);
CREATE INDEX IF NOT EXISTS polar_void_events_recorded_at_idx
  ON polar_void_events (organization_id, recorded_at);
CREATE TABLE IF NOT EXISTS polar_void_rejected_events (
  organization_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  PRIMARY KEY (organization_id, external_id)
) STRICT;
`

const initialized = new WeakSet<SQLiteConnection>()

function transaction<A>(connection: SQLiteConnection, work: () => A): A {
  // BEGIN rejects an open caller transaction before we change or roll back any of its data.
  connection.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    connection.exec('COMMIT')
    return result
  } catch (error) {
    connection.exec('ROLLBACK')
    throw error
  }
}

/** Creates only the SDK-owned tables and indexes. Does not close the connection. */
export function initializeSQLiteEventStorage(
  connection: SQLiteConnection,
): void {
  if (initialized.has(connection)) return
  transaction(connection, () => connection.exec(sqliteEventStorageSchema))
  initialized.add(connection)
}

const decodeEvent = Schema.decodeUnknownSync(EventCreate)

export function persistSQLiteEvents(
  connection: SQLiteConnection,
  organizationId: string,
  events: readonly Required<EventCreate>[],
  { pruneBefore }: PersistOptions = {},
): Required<EventCreate>[] {
  initializeSQLiteEventStorage(connection)
  return transaction(connection, () => {
    if (pruneBefore) {
      connection
        .prepare(
          'DELETE FROM polar_void_events WHERE organization_id = ? AND recorded_at < ?',
        )
        .run(organizationId, pruneBefore.toISOString())
      connection
        .prepare(`
          DELETE FROM polar_void_rejected_events WHERE organization_id = ? AND NOT EXISTS (
            SELECT 1 FROM polar_void_events e
            WHERE e.organization_id = polar_void_rejected_events.organization_id
              AND e.external_id = polar_void_rejected_events.external_id
          )
        `)
        .run(organizationId)
    }
    const insert = connection.prepare(`
      INSERT INTO polar_void_events
        (organization_id, external_id, name, external_identity_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (organization_id, external_id) DO NOTHING
    `)
    const select = connection.prepare(`
      SELECT external_id, name, external_identity_id, timestamp, metadata
      FROM polar_void_events WHERE organization_id = ? AND external_id = ?
    `)
    return events.map((event) => {
      connection
        .prepare(
          'DELETE FROM polar_void_rejected_events WHERE organization_id = ? AND external_id = ?',
        )
        .run(organizationId, event.external_id)
      insert.run(
        organizationId,
        event.external_id,
        event.name,
        event.external_identity_id,
        new Date(event.timestamp).toISOString(),
        JSON.stringify(event.metadata),
      )
      const row = select.get(organizationId, event.external_id)
      if (
        !row ||
        typeof row.metadata !== 'string' ||
        typeof row.timestamp !== 'string'
      ) {
        throw new Error('void: persisted event is missing or malformed')
      }
      const stored = decodeEvent({ ...row, metadata: JSON.parse(row.metadata) })
      return {
        ...stored,
        timestamp: row.timestamp,
        external_identity_id: stored.external_identity_id ?? null,
        metadata: stored.metadata ?? {},
      }
    })
  })
}

export function rejectSQLiteEvents(
  connection: SQLiteConnection,
  organizationId: string,
  events: readonly Required<EventCreate>[],
): void {
  transaction(connection, () => {
    const insert = connection.prepare(
      'INSERT OR IGNORE INTO polar_void_rejected_events VALUES (?, ?)',
    )
    for (const event of events) insert.run(organizationId, event.external_id)
  })
}

export function forgetSQLiteEvents(
  connection: SQLiteConnection,
  organizationId: string,
  externalIds: readonly string[],
): void {
  if (!externalIds.length) return
  const marks = externalIds.map(() => '?').join(',')
  transaction(connection, () => {
    for (const table of ['polar_void_events', 'polar_void_rejected_events'])
      connection
        .prepare(
          `DELETE FROM ${table} WHERE organization_id = ? AND external_id IN (${marks})`,
        )
        .run(organizationId, ...externalIds)
  })
}

/** Read an inclusive event-time range; remote bucket receipts deduplicate the boundary. */
export function readSQLiteEvents(
  connection: SQLiteConnection,
  organizationId: string,
  names: readonly string[],
  identities: readonly string[],
  since: Date | null,
  until: Date,
  recordedSince: Date | null = null,
): StoredEvent[] {
  if (!names.length || !identities.length) return []
  if (
    !connection
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'polar_void_events'",
      )
      .get()
  )
    return []
  const hasRejections =
    connection
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'polar_void_rejected_events'",
      )
      .get() !== undefined
  const rows = connection
    .prepare(`
    SELECT * FROM polar_void_events
    WHERE organization_id = ?
      ${
        hasRejections
          ? `AND NOT EXISTS (
        SELECT 1 FROM polar_void_rejected_events rejected
        WHERE rejected.organization_id = polar_void_events.organization_id
          AND rejected.external_id = polar_void_events.external_id
      )`
          : ''
      }
      AND name IN (${names.map(() => '?').join(',')})
      AND external_identity_id IN (${identities.map(() => '?').join(',')})
      ${since === null ? '' : 'AND timestamp >= ?'}
      AND timestamp <= ?
      ${recordedSince === null ? '' : 'AND recorded_at >= ?'}
    ORDER BY timestamp, external_id
  `)
    .all(
      organizationId,
      ...names,
      ...identities,
      ...(since === null ? [] : [since.toISOString()]),
      until.toISOString(),
      ...(recordedSince === null ? [] : [recordedSince.toISOString()]),
    )
  return rows.map(decodeStoredEvent)
}

function decodeStoredEvent(row: Record<string, unknown>): StoredEvent {
  if (
    typeof row.metadata !== 'string' ||
    typeof row.recorded_at !== 'string' ||
    typeof row.organization_id !== 'string'
  ) {
    throw new Error('void: stored event is malformed')
  }
  const event = decodeEvent({ ...row, metadata: JSON.parse(row.metadata) })
  return {
    ...event,
    timestamp: new Date(event.timestamp!).toISOString(),
    external_identity_id: event.external_identity_id ?? null,
    metadata: event.metadata ?? {},
    organization_id: row.organization_id,
    recorded_at: row.recorded_at,
  }
}
