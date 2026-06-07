/**
 * The flusher drains the local outbox to a sink, fault-tolerantly.
 *
 * Invariants:
 *   - Events are sent in seq order; the durable cursor only ever advances past
 *     an event once it's been confirmed delivered OR dead-lettered.
 *   - A transient failure (ApiUnavailable) halts the tick with the cursor
 *     unmoved — nothing is lost, the next tick retries from the same point.
 *   - A permanent rejection (BatchRejected) triggers a per-event isolation pass
 *     so one poison event is dead-lettered without blocking the good ones.
 *
 * Fast path is a whole-batch POST (one API call). Only on a 4xx do we fall back
 * to sending the batch event-by-event to find the poison.
 *
 * The delivery primitive (`deliver`) is shared with self-heal (selfheal.ts),
 * which re-sends a targeted set of events without touching the cursor.
 */
import { Clock, Effect, Schedule } from 'effect'
import type { EventStore } from './store'
import type { IngestionSink } from './sink'
import type { UsageEvent } from './events'

export interface FlushOptions {
  /** Cursor name — lets multiple independent sinks track their own progress. */
  readonly cursorName?: string
  readonly batchSize?: number
  /**
   * Retry policy for transient (ApiUnavailable) failures within a single send.
   * Default: jittered exponential backoff, ~5 attempts. Tests pass a no-delay
   * schedule for speed.
   */
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown>
}

export interface FlushReport {
  readonly delivered: number
  readonly deadLettered: number
  readonly batches: number
  /** True if the tick stopped early on a transient failure (events buffered). */
  readonly halted: boolean
}

const defaultRetry = Schedule.exponential('100 millis').pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
)

const lastSeq = (events: readonly UsageEvent[]): number =>
  events[events.length - 1]!.seq

export type SendOutcome = 'ok' | 'rejected' | 'unavailable'

/**
 * One send attempt, retrying only transient (ApiUnavailable) failures. Collapses
 * the three outcomes into a tagged value so callers can use plain control flow.
 */
export const trySend = (
  sink: IngestionSink,
  events: readonly UsageEvent[],
  schedule: Schedule.Schedule<unknown, unknown> = defaultRetry,
): Effect.Effect<SendOutcome> =>
  sink.send(events).pipe(
    Effect.retry({ schedule, while: (e) => e._tag === 'ApiUnavailable' }),
    Effect.map(() => 'ok' as const),
    Effect.catchTag('BatchRejected', () => Effect.succeed('rejected' as const)),
    Effect.catchTag('ApiUnavailable', () =>
      Effect.succeed('unavailable' as const),
    ),
  )

export interface DeliverResult {
  readonly delivered: number
  readonly deadLettered: number
  readonly batches: number
  readonly halted: boolean
}

export interface DeliverOptions {
  readonly batchSize?: number
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown>
  /** Called with the seq of each event/batch as it's confirmed delivered or dead-lettered. */
  readonly onProgress?: (seq: number) => void
  /** Dead-letter reason recorded for permanently-rejected events. */
  readonly reason?: string
}

/**
 * Send a fixed list of events through the sink, fault-tolerantly: whole-batch
 * fast path, backoff-retry on transient failure (halt), per-event isolation +
 * dead-letter on permanent rejection. Does NOT manage any cursor — that's the
 * caller's job via `onProgress`.
 */
export const deliver = (
  store: EventStore,
  sink: IngestionSink,
  events: readonly UsageEvent[],
  options: DeliverOptions = {},
): Effect.Effect<DeliverResult> =>
  Effect.gen(function* () {
    const batchSize = options.batchSize ?? 100
    const schedule = options.retrySchedule ?? defaultRetry
    const onProgress = options.onProgress
    const reason = options.reason ?? 'rejected by sink (4xx)'

    let delivered = 0
    let deadLettered = 0
    let batches = 0
    let halted = false

    for (let i = 0; i < events.length && !halted; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      batches += 1

      const fast = yield* trySend(sink, batch, schedule)
      if (fast === 'ok') {
        delivered += batch.length
        onProgress?.(lastSeq(batch))
        continue
      }
      if (fast === 'unavailable') {
        halted = true // transient — leave the rest for a later attempt
        break
      }

      // rejected: isolate, in order, so good events go through and the poison parks.
      for (const event of batch) {
        const one = yield* trySend(sink, [event], schedule)
        if (one === 'unavailable') {
          halted = true
          break
        }
        if (one === 'rejected') {
          const at = yield* Clock.currentTimeMillis
          store.deadLetter(event, reason, at)
          deadLettered += 1
        } else {
          delivered += 1
        }
        onProgress?.(event.seq)
      }
    }

    return { delivered, deadLettered, batches, halted }
  })

/** Drain the outbox once: keep pulling batches from the cursor until empty or halted. */
export const flushOnce = (
  store: EventStore,
  sink: IngestionSink,
  options: FlushOptions = {},
): Effect.Effect<FlushReport> =>
  Effect.gen(function* () {
    const cursorName = options.cursorName ?? 'polar'
    const batchSize = options.batchSize ?? 100
    const schedule = options.retrySchedule ?? defaultRetry

    let delivered = 0
    let deadLettered = 0
    let batches = 0
    let halted = false

    while (!halted) {
      const batch = store.read(store.getCursor(cursorName), batchSize)
      if (batch.length === 0) break

      // Advancing the cursor on progress is what makes delivery durable and resumable.
      const r = yield* deliver(store, sink, batch, {
        batchSize,
        retrySchedule: schedule,
        onProgress: (seq) => store.setCursor(cursorName, seq),
      })
      delivered += r.delivered
      deadLettered += r.deadLettered
      batches += r.batches
      if (r.halted) halted = true
    }

    return { delivered, deadLettered, batches, halted }
  })

/**
 * Run the flusher forever on a fixed interval. Returns an Effect you fork as a
 * background fiber; cancel the fiber to stop. Each tick drains fully, so a
 * backlog accumulated during an outage clears as fast as the sink allows.
 */
export const runFlusher = (
  store: EventStore,
  sink: IngestionSink,
  intervalMillis: number,
  options: FlushOptions = {},
): Effect.Effect<never> =>
  flushOnce(store, sink, options).pipe(
    Effect.flatMap((report) =>
      report.delivered + report.deadLettered > 0
        ? Effect.logInfo(
            `flushed ${report.delivered} delivered, ${report.deadLettered} dead-lettered`,
          )
        : Effect.void,
    ),
    Effect.repeat(Schedule.spaced(`${intervalMillis} millis`)),
  ) as Effect.Effect<never>
