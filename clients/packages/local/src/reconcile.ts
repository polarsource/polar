/**
 * Reconciliation — the trust layer. It answers: "does what we believe we
 * delivered to Polar match what Polar actually metered?" Polar's numbers are
 * authoritative for money; a divergence is a *signal* (a dropped event, a
 * dedup/clock bug, a meter-definition mismatch, or a dead-lettered event Polar
 * never saw), not a negotiation.
 *
 * Two things make the comparison honest:
 *
 *   1. **The watermark.** The local fold runs ahead of delivery, so we only
 *      count events with `seq ≤ flush cursor` — what's been confirmed sent —
 *      and exclude dead-lettered events (Polar rejected those; they'll never be
 *      in its meters). That set is "what we believe Polar successfully ingested".
 *
 *   2. **A wide window.** Polar attributes quantities by *receipt time*, not the
 *      event timestamp, so near a period boundary the two can disagree on which
 *      bucket a backdated/late event lands in. Reconcile over a window wide
 *      enough to contain everything (Polar's `total` is then directly comparable)
 *      — this is a delivery-integrity check, not a per-bucket audit.
 */
import { Effect } from "effect";
import { compileMeters } from "./compile";
import type { Plan } from "./dsl";
import { invoice, replay } from "./engine";
import { customerKey, type CustomerRef, inPeriod, type Period, type UsageEvent } from "./events";
import type { PolarClient } from "./polar-client";
import { listMeters, PolarApiError } from "./push";

export type TimeInterval = "year" | "month" | "week" | "day" | "hour";

export interface ReconcileArgs {
  readonly customer: CustomerRef;
  /** The query window. Make it wide enough to contain all delivered events. */
  readonly period: Period;
  /** Which flush cursor marks "delivered". Defaults to "polar". */
  readonly cursorName?: string;
  /** Polar requires an interval; it doesn't affect the `total` we compare. */
  readonly interval?: TimeInterval;
  readonly organizationId?: string;
}

export type ReconcileStatus = "match" | "mismatch" | "missing-meter";

export interface ReconcileLine {
  readonly meter: string;
  /** Local quantity over delivered, non-dead-lettered events in the window. */
  readonly local: bigint;
  /** Polar's authoritative total, or null if the meter isn't in Polar / not comparable. */
  readonly polar: bigint | null;
  /** local − polar (positive = local has more than Polar metered). */
  readonly delta: bigint | null;
  readonly status: ReconcileStatus;
}

export interface ReconcileReport {
  readonly customerKey: string;
  /** The seq up to which events were considered delivered. */
  readonly watermarkSeq: number;
  /** Dead-lettered events excluded from the local basis (Polar never metered these). */
  readonly deadLettered: number;
  readonly lines: ReadonlyArray<ReconcileLine>;
  /** True iff every line matched. */
  readonly ok: boolean;
}

/** Minimal slice of the store reconciliation needs — satisfied by any EventStore. */
export interface ReconcileSource {
  all(): UsageEvent[];
  getCursor(name: string): number;
  deadLetters(): ReadonlyArray<{ external_id: string }>;
}

/**
 * Pure: the local quantity per meter over the *delivered* basis — events with
 * `seq ≤ cursor`, not dead-lettered, within the window. Reuses the engine fold,
 * so it agrees with the invoice by construction.
 */
export const deliveredQuantities = (
  plan: Plan,
  events: readonly UsageEvent[],
  deadLetterIds: ReadonlySet<string>,
  cursor: number,
  customer: CustomerRef,
  period: Period,
): Map<string, bigint> => {
  const delivered = events.filter(
    (e) => e.seq <= cursor && !deadLetterIds.has(e.external_id) && inPeriod(e, period),
  );
  const inv = invoice(plan, replay(plan, delivered), { customer, period, rulesetVersion: "reconcile" });
  return new Map(inv.lines.map((l) => [l.meter, l.quantity]));
};

const iso = (epochMillis: number) => new Date(epochMillis).toISOString();

/** A Polar `total` is comparable only if it's a whole number (our quantities are integers). */
const toQuantity = (total: unknown): bigint | null =>
  typeof total === "number" && Number.isInteger(total) ? BigInt(total) : null;

interface QuantityQuery {
  readonly start_timestamp: string;
  readonly end_timestamp: string;
  readonly interval: TimeInterval;
  readonly external_customer_id?: string;
  readonly customer_id?: string;
}

/** GET a meter's quantities for the window, returning Polar's period `total`. */
const fetchTotal = (
  client: PolarClient,
  id: string,
  query: QuantityQuery,
): Effect.Effect<{ total?: number } | undefined, PolarApiError> =>
  Effect.tryPromise({
    try: () => client.GET("/v1/meters/{id}/quantities", { params: { path: { id }, query } }),
    catch: (cause) => new PolarApiError({ status: "network", message: String(cause) }),
  }).pipe(
    Effect.flatMap(({ data, error, response }) =>
      response.ok && !error
        ? Effect.succeed(data)
        : Effect.fail(new PolarApiError({ status: response.status, message: `HTTP ${response.status}` })),
    ),
  );

export const reconcile = (
  client: PolarClient,
  source: ReconcileSource,
  plan: Plan,
  args: ReconcileArgs,
): Effect.Effect<ReconcileReport, PolarApiError> =>
  Effect.gen(function* () {
    const cursor = source.getCursor(args.cursorName ?? "polar");
    const deadLetterIds = new Set(source.deadLetters().map((d) => d.external_id));
    const local = deliveredQuantities(plan, source.all(), deadLetterIds, cursor, args.customer, args.period);

    // Map Polar meters by name so we can resolve each plan meter to its id.
    const meters = yield* listMeters(client, args.organizationId);
    const byName = new Map(meters.map((m) => [m.name, m]));

    // Customer filter for the quantities query — by external id or Polar UUID.
    const customerQuery =
      "external_customer_id" in args.customer
        ? { external_customer_id: args.customer.external_customer_id }
        : { customer_id: args.customer.customer_id };

    const lines: ReconcileLine[] = [];
    for (const meter of compileMeters(plan).meters) {
      const localQty = local.get(meter.name) ?? 0n;
      const polarMeter = byName.get(meter.name);
      if (!polarMeter) {
        lines.push({ meter: meter.name, local: localQty, polar: null, delta: null, status: "missing-meter" });
        continue;
      }
      const data = yield* fetchTotal(client, polarMeter.id, {
        start_timestamp: iso(args.period.from),
        end_timestamp: iso(args.period.to),
        interval: args.interval ?? "day",
        ...customerQuery,
      });
      const polarQty = toQuantity(data?.total);
      const delta = polarQty === null ? null : localQty - polarQty;
      const status: ReconcileStatus = delta === 0n ? "match" : "mismatch";
      lines.push({ meter: meter.name, local: localQty, polar: polarQty, delta, status });
    }

    return {
      customerKey: customerKey(args.customer),
      watermarkSeq: cursor,
      deadLettered: deadLetterIds.size,
      lines,
      ok: lines.every((l) => l.status === "match"),
    };
  });
