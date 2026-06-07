/**
 * Durable local persistence — the linchpin of fault tolerance.
 *
 * The store is the **commit point**: once `append` returns, the event is on
 * disk and will survive a crash. It plays two roles at once:
 *
 *   1. the canonical billing log the pure fold replays (engine.ts), and
 *   2. the outbox the flusher forwards to Polar (flusher.ts).
 *
 * Both read the same ordered, append-only log; the flusher just tracks how far
 * it has confirmed delivery via a durable cursor. Nothing is ever mutated or
 * deleted in flight — delivery state lives in a separate cursor, not on the
 * events — so replay stays deterministic no matter what the network does.
 *
 * Events are stored Polar-shaped (the full event minus the internal envelope)
 * as a JSON payload, with the queryable bits (external_id, name, customer key,
 * timestamp) lifted into columns. `append` is idempotent on `external_id`
 * (UNIQUE) — Polar's dedup key, doubling as ours.
 */
import { DatabaseSync } from 'node:sqlite'
import { customerKey, type UsageEvent } from './events'
import type { PolarEvent } from './polar'

/** A Polar-shaped event ready to store — the store assigns seq, id, and v. */
export type DraftEvent = PolarEvent & {
  readonly timestamp: string
  readonly external_id: string // required: our dedup / idempotency key
}

export interface DeadLetter {
  readonly seq: number
  readonly external_id: string
  readonly reason: string
  readonly failedAt: number
  readonly event: UsageEvent
}

export interface EventStore {
  /** Durably append (or return the existing event for a duplicate external_id). */
  append(draft: DraftEvent): UsageEvent
  /** Events with `seq > afterSeq`, in order, up to `limit`. The flusher's read. */
  read(afterSeq: number, limit: number): UsageEvent[]
  /** The whole log, in order — what the fold replays. */
  all(): UsageEvent[]
  /** Flush high-water mark for a named consumer. -1 if never set. */
  getCursor(name: string): number
  setCursor(name: string, seq: number): void
  /** Park an event Polar permanently rejected (bad data) for operator review. */
  deadLetter(event: UsageEvent, reason: string, at: number): void
  deadLetters(): DeadLetter[]
  close(): void
}

const idOf = (seq: number): string => `evt_${seq}`

/** Rebuild a full UsageEvent from a stored payload + envelope columns. */
const toEvent = (payload: string, seq: number, v: number): UsageEvent => ({
  ...(JSON.parse(payload) as DraftEvent),
  kind: 'usage',
  seq,
  id: idOf(seq),
  v,
})

// ── SQLite (production) ──────────────────────────────────────────────────────

interface EventRow {
  seq: number
  v: number
  payload: string
}

interface DeadLetterRow extends EventRow {
  external_id: string
  reason: string
  failed_at: number
}

export class SqliteEventStore implements EventStore {
  private readonly db: DatabaseSync

  constructor(path = 'local.db') {
    this.db = new DatabaseSync(path)
    // WAL + NORMAL: durable across an app crash with low write latency. Bump to
    // `synchronous = FULL` if you must survive OS/power loss of the last commit.
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA synchronous = NORMAL;')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        customer_key TEXT   NOT NULL,
        timestamp   TEXT    NOT NULL,
        v           INTEGER NOT NULL,
        payload     TEXT    NOT NULL
      )`)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cursors (
        name TEXT PRIMARY KEY,
        seq  INTEGER NOT NULL
      )`)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dead_letters (
        seq         INTEGER NOT NULL,
        external_id TEXT    NOT NULL,
        v           INTEGER NOT NULL,
        payload     TEXT    NOT NULL,
        reason      TEXT    NOT NULL,
        failed_at   INTEGER NOT NULL
      )`)
  }

  append(draft: DraftEvent): UsageEvent {
    const payload = JSON.stringify(draft)
    // Single-process, synchronous driver: insert then re-read runs atomically
    // back-to-back. The re-read returns the fresh row or the existing one on
    // conflict, which is what makes append idempotent on external_id.
    this.db
      .prepare(
        `INSERT INTO events (external_id, name, customer_key, timestamp, v, payload)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(external_id) DO NOTHING`,
      )
      .run(
        draft.external_id,
        draft.name,
        customerKey(draft),
        draft.timestamp,
        1,
        payload,
      )
    const row = this.db
      .prepare(`SELECT seq, v, payload FROM events WHERE external_id = ?`)
      .get(draft.external_id) as unknown as EventRow
    return toEvent(row.payload, row.seq, row.v)
  }

  read(afterSeq: number, limit: number): UsageEvent[] {
    const rows = this.db
      .prepare(
        `SELECT seq, v, payload FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?`,
      )
      .all(afterSeq, limit) as unknown as EventRow[]
    return rows.map((r) => toEvent(r.payload, r.seq, r.v))
  }

  all(): UsageEvent[] {
    const rows = this.db
      .prepare(`SELECT seq, v, payload FROM events ORDER BY seq ASC`)
      .all() as unknown as EventRow[]
    return rows.map((r) => toEvent(r.payload, r.seq, r.v))
  }

  getCursor(name: string): number {
    const row = this.db
      .prepare(`SELECT seq FROM cursors WHERE name = ?`)
      .get(name) as unknown as { seq: number } | undefined
    return row?.seq ?? -1
  }

  setCursor(name: string, seq: number): void {
    this.db
      .prepare(
        `INSERT INTO cursors (name, seq) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET seq = excluded.seq`,
      )
      .run(name, seq)
  }

  deadLetter(event: UsageEvent, reason: string, at: number): void {
    this.db
      .prepare(
        `INSERT INTO dead_letters (seq, external_id, v, payload, reason, failed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.seq,
        event.external_id,
        event.v,
        JSON.stringify(stripEnvelope(event)),
        reason,
        at,
      )
  }

  deadLetters(): DeadLetter[] {
    const rows = this.db
      .prepare(`SELECT * FROM dead_letters ORDER BY seq ASC`)
      .all() as unknown as DeadLetterRow[]
    return rows.map((r) => ({
      seq: r.seq,
      external_id: r.external_id,
      reason: r.reason,
      failedAt: r.failed_at,
      event: toEvent(r.payload, r.seq, r.v),
    }))
  }

  close(): void {
    this.db.close()
  }
}

/** Drop the internal envelope, leaving the Polar-shaped payload. */
const stripEnvelope = (event: UsageEvent): DraftEvent => {
  const { kind: _k, seq: _s, id: _i, v: _v, ...polar } = event
  return polar as DraftEvent
}

// ── In-memory (tests, ephemeral) ─────────────────────────────────────────────

export class MemoryEventStore implements EventStore {
  private readonly log: UsageEvent[] = []
  private readonly byKey = new Map<string, UsageEvent>()
  private readonly cursors = new Map<string, number>()
  private readonly dlq: DeadLetter[] = []
  private nextSeq = 1 // mirror SQLite AUTOINCREMENT (starts at 1)

  append(draft: DraftEvent): UsageEvent {
    const existing = this.byKey.get(draft.external_id)
    if (existing) return existing
    const seq = this.nextSeq++
    const event = toEvent(JSON.stringify(draft), seq, 1)
    this.log.push(event)
    this.byKey.set(draft.external_id, event)
    return event
  }

  read(afterSeq: number, limit: number): UsageEvent[] {
    return this.log.filter((e) => e.seq > afterSeq).slice(0, limit)
  }

  all(): UsageEvent[] {
    return [...this.log]
  }

  getCursor(name: string): number {
    return this.cursors.get(name) ?? -1
  }

  setCursor(name: string, seq: number): void {
    this.cursors.set(name, seq)
  }

  deadLetter(event: UsageEvent, reason: string, at: number): void {
    this.dlq.push({
      seq: event.seq,
      external_id: event.external_id,
      reason,
      failedAt: at,
      event,
    })
  }

  deadLetters(): DeadLetter[] {
    return [...this.dlq]
  }

  close(): void {}
}
