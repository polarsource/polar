import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Effect, Schedule } from 'effect'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UsageEvent } from '../src/events'
import { flushOnce } from '../src/flusher'
import {
  ApiUnavailable,
  BatchRejected,
  type IngestionSink,
  type SinkResult,
} from '../src/sink'
import { MemoryEventStore, SqliteEventStore } from '../src/store'

/** No backoff delays — keeps the transient-failure tests instant. */
const noRetry = Schedule.recurs(0)
const run = <A>(eff: Effect.Effect<A>) => Effect.runPromise(eff)

/**
 * A sink you can steer: make it unavailable for the first N sends (simulating
 * an outage), and/or permanently reject specific idempotency keys (poison).
 */
function controllableSink(
  opts: { outageForFirst?: number; poison?: ReadonlySet<string> } = {},
) {
  let outageLeft = opts.outageForFirst ?? 0
  const poison = opts.poison ?? new Set<string>()
  const received: UsageEvent[] = []
  const sink: IngestionSink = {
    send: (events) =>
      Effect.suspend(
        (): Effect.Effect<SinkResult, ApiUnavailable | BatchRejected> => {
          if (outageLeft > 0) {
            outageLeft -= 1
            return Effect.fail(
              new ApiUnavailable({ status: 503, message: 'service down' }),
            )
          }
          const bad = events.find((e) => poison.has(e.external_id))
          if (bad)
            return Effect.fail(
              new BatchRejected({
                status: 422,
                message: `invalid ${bad.external_id}`,
              }),
            )
          received.push(...events)
          return Effect.succeed({ accepted: events.length, duplicates: 0 })
        },
      ),
  }
  return { sink, received, recover: () => (outageLeft = 0) }
}

const seed = (store: MemoryEventStore, keys: readonly string[]) =>
  keys.map((k, i) =>
    store.append({
      name: 'tokens',
      external_customer_id: 'acme',
      metadata: { amount: i + 1 },
      timestamp: new Date(1_000 + i).toISOString(),
      external_id: k,
    }),
  )

describe('flush — happy path', () => {
  test('delivers every event once and advances the cursor to the end', async () => {
    const store = new MemoryEventStore()
    seed(store, ['a', 'b', 'c'])
    const { sink, received } = controllableSink()

    const report = await run(flushOnce(store, sink, { retrySchedule: noRetry }))

    expect(report).toMatchObject({
      delivered: 3,
      deadLettered: 0,
      halted: false,
    })
    expect(received.map((e) => e.external_id)).toEqual(['a', 'b', 'c'])
    expect(store.getCursor('polar')).toBe(3)
  })

  test('a second flush with nothing new is a no-op', async () => {
    const store = new MemoryEventStore()
    seed(store, ['a', 'b'])
    const { sink, received } = controllableSink()

    await run(flushOnce(store, sink, { retrySchedule: noRetry }))
    const second = await run(flushOnce(store, sink, { retrySchedule: noRetry }))

    expect(second).toMatchObject({ delivered: 0, batches: 0 })
    expect(received).toHaveLength(2) // not re-sent
  })
})

describe('flush — API outage (the fault-tolerance case)', () => {
  test('an outage halts the tick with NOTHING lost and the cursor unmoved', async () => {
    const store = new MemoryEventStore()
    seed(store, ['a', 'b', 'c'])
    const { sink, received, recover } = controllableSink({
      outageForFirst: 100,
    })

    const down = await run(flushOnce(store, sink, { retrySchedule: noRetry }))
    expect(down).toMatchObject({ delivered: 0, halted: true })
    expect(received).toHaveLength(0)
    expect(store.getCursor('polar')).toBe(-1) // buffered, not advanced

    // API recovers; the backlog drains on the next tick.
    recover()
    const up = await run(flushOnce(store, sink, { retrySchedule: noRetry }))
    expect(up).toMatchObject({ delivered: 3, halted: false })
    expect(received.map((e) => e.external_id)).toEqual(['a', 'b', 'c'])
    expect(store.getCursor('polar')).toBe(3)
  })
})

describe('flush — poison isolation', () => {
  test('a permanently-rejected event is dead-lettered without blocking the rest', async () => {
    const store = new MemoryEventStore()
    seed(store, ['a', 'bad', 'c'])
    const { sink, received } = controllableSink({ poison: new Set(['bad']) })

    const report = await run(flushOnce(store, sink, { retrySchedule: noRetry }))

    expect(report).toMatchObject({
      delivered: 2,
      deadLettered: 1,
      halted: false,
    })
    expect(received.map((e) => e.external_id)).toEqual(['a', 'c']) // good ones through
    expect(store.deadLetters().map((d) => d.external_id)).toEqual(['bad'])
    expect(store.getCursor('polar')).toBe(3) // advanced past the poison
  })
})

describe('flush — durability across a restart (SQLite)', () => {
  let dir: string
  beforeAll(() => (dir = mkdtempSync(join(tmpdir(), 'local-'))))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  test('the log and the flush cursor survive close/reopen — no re-delivery', async () => {
    const path = join(dir, 'restart.db')

    // Process 1: append, flush, crash (close).
    const s1 = new SqliteEventStore(path)
    ;['a', 'b', 'c'].forEach((k, i) =>
      s1.append({
        name: 'tokens',
        external_customer_id: 'acme',
        metadata: { amount: i },
        timestamp: new Date(i).toISOString(),
        external_id: k,
      }),
    )
    const { sink: sink1, received: received1 } = controllableSink()
    await run(flushOnce(s1, sink1, { retrySchedule: noRetry }))
    expect(received1).toHaveLength(3)
    s1.close()

    // Process 2: reopen the same file. Cursor and log are still there.
    const s2 = new SqliteEventStore(path)
    expect(s2.all().map((e) => e.external_id)).toEqual(['a', 'b', 'c']) // log persisted
    expect(s2.getCursor('polar')).toBe(3) // cursor persisted

    const { sink: sink2, received: received2 } = controllableSink()
    const report = await run(flushOnce(s2, sink2, { retrySchedule: noRetry }))
    expect(report.delivered).toBe(0) // nothing past the cursor → no re-send
    expect(received2).toHaveLength(0)
    s2.close()
  })

  test('append is idempotent on external_id across calls', async () => {
    const path = join(dir, 'idem.db')
    const store = new SqliteEventStore(path)
    const a = store.append({
      name: 'm',
      external_customer_id: 'acme',
      metadata: { amount: 1 },
      timestamp: new Date(0).toISOString(),
      external_id: 'x',
    })
    const b = store.append({
      name: 'm',
      external_customer_id: 'acme',
      metadata: { amount: 999 },
      timestamp: new Date(5).toISOString(),
      external_id: 'x',
    })
    expect(b.seq).toBe(a.seq) // same event; the second submit is a no-op
    expect(store.all()).toHaveLength(1)
    expect(store.all()[0]!.metadata).toEqual({ amount: 1 }) // first write wins
    store.close()
  })
})
