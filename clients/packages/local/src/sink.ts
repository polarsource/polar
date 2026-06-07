/**
 * An IngestionSink is wherever events get forwarded — Polar in production, a
 * fake in tests. The fault-tolerance contract lives in its two error types:
 *
 *   ApiUnavailable  — transient. RETRYABLE. Events stay buffered; never dropped.
 *                     (network, 5xx, 429 rate-limit, 401/403 bad token, 404
 *                     wrong URL — anything that a fix-and-retry can resolve.)
 *   BatchRejected   — permanent bad data (HTTP 422 validation). NOT retryable.
 *                     The offending event is dead-lettered so one poison event
 *                     can't wedge the stream.
 *
 * Why only 422 is permanent: it's Polar's per-event validation error, which the
 * flusher's isolation pass can pin to the exact bad event. Treating auth/URL/5xx
 * as permanent would dead-letter good events over a config mistake — for billing
 * a visible, growing backlog is far safer than silent data loss.
 *
 * Delivery is at-least-once; Polar deduplicates on `external_id` (we map our
 * idempotencyKey to it), making the end result effectively-once.
 */
import type { schemas } from '@polar-sh/client'
import { Data, Effect } from 'effect'
import type { UsageEvent } from './events'
import type { PolarClient } from './polar-client'
import type { PolarEvent } from './polar'
import { POLAR_LIMITS, validatePolarEvent } from './polar'

export class ApiUnavailable extends Data.TaggedError('ApiUnavailable')<{
  readonly status: number | 'network'
  readonly message: string
  /** Seconds from a 429 `Retry-After` header, when present. */
  readonly retryAfter?: number
}> {}

export class BatchRejected extends Data.TaggedError('BatchRejected')<{
  readonly status: number
  readonly message: string
}> {}

export interface SinkResult {
  /** Events Polar inserted (from the `inserted` field of the response). */
  readonly accepted: number
  /** Events Polar skipped as duplicates of an already-ingested external_id. */
  readonly duplicates: number
}

export interface IngestionSink {
  send(
    events: readonly UsageEvent[],
  ): Effect.Effect<SinkResult, ApiUnavailable | BatchRejected>
}

// ── Polar ────────────────────────────────────────────────────────────────────

export interface PolarSinkConfig {
  /** A `@polar-sh/client` instance (see `polarClient`). */
  readonly client: PolarClient
  /** Injected into each event if it doesn't already carry one — for non-org tokens. */
  readonly organizationId?: string
  /** Full control: map a UsageEvent to a Polar event yourself. Overrides the default. */
  readonly mapEvent?: (event: UsageEvent) => PolarEvent
}

/** Polar's 422 body shape: `{ detail: [{ loc, msg, type }] }`. */
interface HTTPValidationError {
  readonly detail?: ReadonlyArray<{
    loc?: ReadonlyArray<string | number>
    msg?: string
  }>
}

const summarizeValidation = (error: unknown, fallback: string): string => {
  const detail = (error as HTTPValidationError | undefined)?.detail
  if (!detail?.length) return fallback
  return detail
    .map((d) => `${(d.loc ?? []).join('.')}: ${d.msg ?? 'invalid'}`)
    .join('; ')
}

export const polarSink = (config: PolarSinkConfig): IngestionSink => {
  // The event is already Polar-shaped (events.ts). Forwarding is essentially an
  // identity map: drop the internal envelope, optionally inject organization_id.
  const defaultMap = (e: UsageEvent): PolarEvent => {
    const { kind: _kind, seq: _seq, id: _id, v: _v, ...polar } = e
    return config.organizationId && polar.organization_id == null
      ? ({ ...polar, organization_id: config.organizationId } as PolarEvent)
      : (polar as PolarEvent)
  }

  const mapEvent = config.mapEvent ?? defaultMap

  return {
    send: (events) =>
      Effect.gen(function* () {
        const mapped = events.map(mapEvent)

        // Pre-flight validation against Polar's documented limits. A violation
        // is permanent bad data (would 422 anyway) — fail now so the flusher's
        // isolation pass dead-letters the exact offender without a round trip.
        for (let i = 0; i < mapped.length; i++) {
          const problem = validatePolarEvent(mapped[i]!)
          if (problem) {
            return yield* Effect.fail(
              new BatchRejected({
                status: 422,
                message: `event ${events[i]!.id}: ${problem}`,
              }),
            )
          }
        }

        const { data, error, response } = yield* Effect.tryPromise({
          // Cast: our PolarEvent mirrors the schema but differs in readonly/array variance.
          try: () =>
            config.client.POST('/v1/events/ingest', {
              body: { events: mapped } as unknown as schemas['EventsIngest'],
            }),
          // A thrown request is a network failure → transient, keep the events.
          catch: (cause) =>
            new ApiUnavailable({ status: 'network', message: String(cause) }),
        })

        if (response.ok && data) {
          return {
            accepted: data.inserted ?? events.length,
            duplicates: data.duplicates ?? 0,
          }
        }

        // 422 is per-event validation → permanent. Everything else is transient
        // and stays buffered (see the module header for the rationale).
        if (response.status === 422) {
          return yield* Effect.fail(
            new BatchRejected({
              status: 422,
              message: summarizeValidation(error, 'validation error'),
            }),
          )
        }

        const message = summarizeValidation(error, `HTTP ${response.status}`)
        const retryAfter =
          response.status === 429
            ? parseRetryAfter(response.headers.get('Retry-After'))
            : undefined
        return yield* Effect.fail(
          new ApiUnavailable({
            status: response.status,
            message,
            ...(retryAfter !== undefined ? { retryAfter } : {}),
          }),
        )
      }),
  }
}

const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) return undefined
  const seconds = Number(header)
  return Number.isFinite(seconds) ? seconds : undefined
}

export { POLAR_LIMITS }
