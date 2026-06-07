/**
 * Ingestion is the ONE place that touches the clock, and the commit boundary
 * where usage becomes durable. `Clock` is an Effect *service*, not an ambient
 * `Date.now()` — real time in prod, `TestClock` in tests — so given the same
 * clock, store, and inputs, ingestion is deterministic. The pure fold never
 * sees a clock.
 *
 *   raw event ──[ingest: stamp timestamp, validate, durably append]──▶ Store
 *
 * Callers submit Polar-shaped events (minus the timestamp, which we stamp if
 * absent — mirroring how Polar attributes on receipt). Each event is validated
 * against Polar's limits AND local's integer-metadata rule before it's stored;
 * the store assigns the canonical seq/id and deduplicates on external_id.
 */
import { Clock, Data, Effect } from "effect";
import type { UsageEvent } from "./events";
import { validateIntegerMetadata, validatePolarEvent } from "./polar";
import type { DraftEvent, EventStore } from "./store";

/**
 * A submitted event — Polar-shaped, with our required external_id; timestamp
 * optional. Distributive (`T extends unknown`) so the customer union's
 * discriminant (external_customer_id vs customer_id) is preserved, not collapsed
 * by a union-wide `Omit`.
 */
export type RawEvent = DraftEvent extends infer T
  ? T extends unknown
    ? Omit<T, "timestamp"> & { readonly timestamp?: string }
    : never
  : never;

/** Raised when a submitted event violates Polar's limits or the integer-metadata rule. */
export class IngestError extends Data.TaggedError("IngestError")<{
  readonly index: number;
  readonly external_id: string;
  readonly reason: string;
}> {}

/**
 * Stamp each raw event with the current time (if it has none) and durably
 * append it. Fails fast with IngestError on the first invalid event — bad data
 * is rejected at the door, not dead-lettered later. Returns the canonical
 * stored events (the existing one for any duplicate external_id).
 */
export const ingest = (
  store: EventStore,
  raw: readonly RawEvent[],
): Effect.Effect<UsageEvent[], IngestError> =>
  Effect.gen(function* () {
    const nowIso = new Date(yield* Clock.currentTimeMillis).toISOString();
    const out: UsageEvent[] = [];
    for (let i = 0; i < raw.length; i++) {
      // Cast: spreading the customer union widens it in the type system, but the
      // runtime object keeps whichever customer field was supplied.
      const draft = { ...raw[i]!, timestamp: raw[i]!.timestamp ?? nowIso } as DraftEvent;
      const reason = validatePolarEvent(draft) ?? validateIntegerMetadata(draft);
      if (reason) {
        return yield* Effect.fail(new IngestError({ index: i, external_id: draft.external_id, reason }));
      }
      out.push(store.append(draft));
    }
    return out;
  });
