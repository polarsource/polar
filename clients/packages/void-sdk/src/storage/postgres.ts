import { Schema } from 'effect'
import { EventCreate } from '../api/generated'
import type { EventStorage, StoredEvent } from './storage'

type Row = Record<string, unknown>

/**
 * Anything that runs one parameterized statement with `$1` placeholders.
 * `pg.Pool`, `pg.Client`, and Neon's `neon(url)` fit as they are; a
 * postgres.js client fits through `unsafe`, which the adapter detects.
 */
export interface PostgresConnection {
  query(text: string, params: unknown[]): Promise<{ rows: Row[] } | Row[]>
}

/** A postgres.js client: `postgres(url)` exposes raw statements as `unsafe`. */
export interface PostgresJsConnection {
  unsafe(text: string, params: unknown[]): PromiseLike<ArrayLike<Row>>
}

export interface PostgresEventStorageOptions {
  /**
   * Create the SDK tables on first use, once per adapter instance. Convenient
   * in development; in production apply `postgresEventStorageSchema` as a
   * migration instead, so cold starts do not take DDL locks or need DDL rights.
   */
  readonly createTables?: boolean
}

export interface PostgresEventStorage extends EventStorage {
  readonly type: 'postgres'
}

const statements = [
  `CREATE TABLE IF NOT EXISTS polar_void_events (
  organization_id text NOT NULL,
  external_id text NOT NULL,
  name text NOT NULL,
  external_identity_id text,
  timestamp timestamptz NOT NULL,
  metadata jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, external_id)
)`,
  `CREATE INDEX IF NOT EXISTS polar_void_events_identity_timestamp_idx
  ON polar_void_events (organization_id, external_identity_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS polar_void_events_name_timestamp_idx
  ON polar_void_events (organization_id, name, timestamp)`,
  `CREATE INDEX IF NOT EXISTS polar_void_events_recorded_at_idx
  ON polar_void_events (organization_id, recorded_at)`,
  `CREATE TABLE IF NOT EXISTS polar_void_rejected_events (
  organization_id text NOT NULL,
  external_id text NOT NULL,
  PRIMARY KEY (organization_id, external_id)
)`,
]

/** The SDK-owned tables and indexes, for migrations. Idempotent. */
export const postgresEventStorageSchema = statements.join(';\n') + ';\n'

/** Runs the schema one statement at a time, which single-statement HTTP drivers accept. */
export async function initializePostgresEventStorage(
  connection: PostgresConnection | PostgresJsConnection,
): Promise<void> {
  const query = queryOf(connection)
  for (const statement of statements) await query(statement, [])
}

// Every operation is one statement, so the adapter needs no transaction
// primitive and works over pooled connections and one-shot HTTP drivers alike.

// The final SELECT cannot see rows the INSERT CTE wrote in the same statement,
// so new rows come from RETURNING and pre-existing copies from the table.
// Pruning rides along as two more CTEs; $8 NULL disables it.
const persistSql = `
WITH incoming AS (
  SELECT * FROM unnest(
    $1::text[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::jsonb[]
  ) AS t(organization_id, external_id, name, external_identity_id, timestamp, metadata)
),
pruned AS (
  DELETE FROM polar_void_events
  WHERE $8::timestamptz IS NOT NULL AND organization_id = $7 AND recorded_at < $8::timestamptz
),
unmarked AS (
  DELETE FROM polar_void_rejected_events r
  WHERE $8::timestamptz IS NOT NULL AND r.organization_id = $7 AND NOT EXISTS (
    SELECT 1 FROM polar_void_events e
    WHERE e.organization_id = r.organization_id AND e.external_id = r.external_id
  )
),
cleared AS (
  DELETE FROM polar_void_rejected_events r USING incoming i
  WHERE r.organization_id = i.organization_id AND r.external_id = i.external_id
),
inserted AS (
  INSERT INTO polar_void_events
    (organization_id, external_id, name, external_identity_id, timestamp, metadata)
  SELECT organization_id, external_id, name, external_identity_id, timestamp, metadata
  FROM incoming
  ON CONFLICT (organization_id, external_id) DO NOTHING
  RETURNING external_id, name, external_identity_id, timestamp, metadata
)
SELECT external_id, name, external_identity_id, timestamp, metadata FROM inserted
UNION ALL
SELECT e.external_id, e.name, e.external_identity_id, e.timestamp, e.metadata
FROM polar_void_events e
JOIN incoming i ON i.organization_id = e.organization_id AND i.external_id = e.external_id
WHERE NOT EXISTS (SELECT 1 FROM inserted x WHERE x.external_id = e.external_id)
`

const rejectSql = `
INSERT INTO polar_void_rejected_events (organization_id, external_id)
SELECT $1, unnest($2::text[])
ON CONFLICT DO NOTHING
`

const forgetSql = `
WITH gone AS (
  DELETE FROM polar_void_events WHERE organization_id = $1 AND external_id = ANY($2::text[])
)
DELETE FROM polar_void_rejected_events WHERE organization_id = $1 AND external_id = ANY($2::text[])
`

// COLLATE "C" orders ids by bytes, matching SQLite and the in-process sort.
const readSql = `
SELECT organization_id, external_id, name, external_identity_id, timestamp, metadata, recorded_at
FROM polar_void_events e
WHERE organization_id = $1
  AND name = ANY($2::text[])
  AND external_identity_id = ANY($3::text[])
  AND ($4::timestamptz IS NULL OR timestamp >= $4::timestamptz)
  AND timestamp <= $5::timestamptz
  AND ($6::timestamptz IS NULL OR recorded_at >= $6::timestamptz)
  AND NOT EXISTS (
    SELECT 1 FROM polar_void_rejected_events r
    WHERE r.organization_id = e.organization_id AND r.external_id = e.external_id
  )
ORDER BY timestamp, external_id COLLATE "C"
`

const decodeEvent = Schema.decodeUnknownSync(EventCreate)

/**
 * Shared ledger in Postgres. Made for serverless: one statement per
 * operation, no transactions, no connection ownership, any `$1`-style driver.
 * Tables are not created unless `createTables` is set; see
 * `postgresEventStorageSchema`.
 */
export function postgresEventStorage(
  connection: PostgresConnection | PostgresJsConnection,
  options: PostgresEventStorageOptions = {},
): PostgresEventStorage {
  const query = queryOf(connection)
  let ready: Promise<void> | undefined
  const run = async (text: string, params: unknown[]): Promise<Row[]> => {
    if (options.createTables) {
      ready ??= initializePostgresEventStorage(connection).catch((cause) => {
        ready = undefined
        throw cause
      })
      await ready
    }
    try {
      return await query(text, params)
    } catch (cause) {
      if ((cause as { code?: unknown })?.code === '42P01')
        throw new Error(
          'void: Postgres event storage tables are missing; apply postgresEventStorageSchema or pass { createTables: true }',
          { cause },
        )
      throw cause
    }
  }
  return {
    type: 'postgres',
    async persist(organizationId, events, { pruneBefore } = {}) {
      // Drivers serialize arrays; timestamps and metadata travel as text and cast server-side.
      const timestamps = events.map((event) => {
        const at = new Date(event.timestamp)
        if (Number.isNaN(at.getTime()))
          throw new Error(`void: invalid timestamp for ${event.external_id}`)
        return at.toISOString()
      })
      const rows = await run(persistSql, [
        events.map(() => organizationId),
        events.map((event) => event.external_id),
        events.map((event) => event.name),
        events.map((event) => event.external_identity_id),
        timestamps,
        events.map((event) => JSON.stringify(event.metadata)),
        organizationId,
        pruneBefore?.toISOString() ?? null,
      ])
      const stored = new Map(rows.map((row) => [row.external_id, decode(row)]))
      return events.map((event) => {
        const row = stored.get(event.external_id)
        if (!row) throw new Error('void: persisted event is missing')
        const { organization_id: _org, recorded_at: _at, ...copy } = row
        return copy
      })
    },
    async reject(organizationId, events) {
      await run(rejectSql, [
        organizationId,
        events.map((event) => event.external_id),
      ])
    },
    async forget(organizationId, externalIds) {
      if (!externalIds.length) return
      await run(forgetSql, [organizationId, externalIds])
    },
    async read(
      organizationId,
      { names, identities, since, until, recordedSince },
    ) {
      if (!names.length || !identities.length) return []
      const rows = await run(readSql, [
        organizationId,
        names,
        identities,
        since === null ? null : since.toISOString(),
        until.toISOString(),
        recordedSince === null ? null : recordedSince.toISOString(),
      ])
      return rows.map(decode)
    },
  }
}

function queryOf(connection: PostgresConnection | PostgresJsConnection) {
  return async (text: string, params: unknown[]): Promise<Row[]> => {
    const result =
      'unsafe' in connection
        ? await connection.unsafe(text, params)
        : await connection.query(text, params)
    return Array.isArray(result)
      ? result
      : 'rows' in result
        ? result.rows
        : Array.from(result as ArrayLike<Row>)
  }
}

// Drivers differ on whether timestamptz and jsonb arrive parsed; accept both.
const iso = (value: unknown): string => {
  const at = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(at.getTime()))
    throw new Error('void: stored event is malformed')
  return at.toISOString()
}

function decode(row: Row): StoredEvent {
  const metadata =
    typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
  const event = decodeEvent({ ...row, metadata, timestamp: iso(row.timestamp) })
  return {
    ...event,
    timestamp: event.timestamp!,
    external_identity_id: event.external_identity_id ?? null,
    metadata: event.metadata ?? {},
    organization_id: String(row.organization_id ?? ''),
    recorded_at: row.recorded_at === undefined ? '' : iso(row.recorded_at),
  }
}
