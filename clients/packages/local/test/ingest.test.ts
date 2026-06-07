import { describe, expect, test } from 'vitest'
import { Effect, Exit, TestClock, TestContext } from 'effect'
import { ingest, type RawEvent } from '../src/ingest'
import { MemoryEventStore } from '../src/store'

const raw: readonly RawEvent[] = [
  {
    name: 'tokens',
    external_customer_id: 'acme',
    metadata: { amount: 100 },
    external_id: 'a',
  },
  {
    name: 'tokens',
    external_customer_id: 'acme',
    metadata: { amount: 100 },
    external_id: 'a',
  }, // dup
  {
    name: 'requests',
    external_customer_id: 'acme',
    metadata: {},
    external_id: 'b',
  },
]

/** Run an Effect against a frozen TestClock so time is an input, not a surprise. */
const runDeterministic = <A, E>(eff: Effect.Effect<A, E>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(1_700_000_000_000)
      return yield* eff
    }).pipe(Effect.provide(TestContext.TestContext)),
  )

describe('ingestion (clock + durable append)', () => {
  test('duplicate external_id collapses to one durable event', async () => {
    const store = new MemoryEventStore()
    await runDeterministic(ingest(store, raw))
    expect(store.all().map((e) => e.external_id)).toEqual(['a', 'b'])
  })

  test('a duplicate submission returns the SAME event (same seq)', async () => {
    const store = new MemoryEventStore()
    const events = await runDeterministic(ingest(store, raw))
    expect(events[0]!.seq).toBe(events[1]!.seq) // both "a" map to one event
    expect(events[2]!.seq).not.toBe(events[0]!.seq)
  })

  test('a frozen clock stamps a deterministic ISO timestamp when absent', async () => {
    const store = new MemoryEventStore()
    const events = await runDeterministic(ingest(store, raw))
    const expected = new Date(1_700_000_000_000).toISOString()
    expect(events.every((e) => e.timestamp === expected)).toBe(true)
  })

  test('a caller-supplied timestamp is preserved', async () => {
    const store = new MemoryEventStore()
    const ts = '2026-01-01T00:00:00.000Z'
    const [event] = await runDeterministic(
      ingest(store, [
        {
          name: 'tokens',
          external_customer_id: 'acme',
          metadata: { amount: 1 },
          external_id: 'z',
          timestamp: ts,
        },
      ]),
    )
    expect(event!.timestamp).toBe(ts)
  })

  test('the store assigns dense, monotonic seq', async () => {
    const store = new MemoryEventStore()
    await runDeterministic(ingest(store, raw))
    expect(store.all().map((e) => e.seq)).toEqual([1, 2])
  })

  test('non-integer metadata is rejected at the door with IngestError', async () => {
    const store = new MemoryEventStore()
    const exit = await runDeterministic(
      Effect.exit(
        ingest(store, [
          {
            name: 'gpu',
            external_customer_id: 'acme',
            metadata: { gb_seconds: 1.5 },
            external_id: 'bad',
          },
        ]),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      expect(exit.cause.error._tag).toBe('IngestError')
      expect(exit.cause.error.reason).toContain('must be an integer')
    }
    expect(store.all()).toHaveLength(0) // nothing persisted
  })
})
