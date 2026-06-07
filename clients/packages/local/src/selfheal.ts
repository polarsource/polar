/**
 * Self-heal — close the reconciliation loop.
 *
 * When `reconcile` finds Polar short on a meter (local quantity > Polar's, a
 * positive delta), the fix is to re-send the events backing that meter. This is
 * safe precisely because of the delivery design: at-least-once + Polar dedup on
 * `external_id` means re-sending events Polar already has is a no-op, while the
 * genuinely-missing ones land. No cursor is touched — these are deliberate
 * re-sends of already-delivered events.
 *
 * What it will NOT try to fix by re-flushing (re-sending can't help, so they're
 * surfaced as `skipped`):
 *   - negative delta (Polar counted MORE than we think we delivered) — a dedup
 *     or double-count anomaly to investigate, not a gap.
 *   - missing-meter — the meter isn't in Polar yet; run `syncMeters` (push).
 */
import { Effect } from "effect";
import type { Plan } from "./dsl";
import { customerKey, type CustomerRef, inPeriod, type Period } from "./events";
import { deliver, type DeliverOptions } from "./flusher";
import type { PolarClient } from "./polar-client";
import type { PolarApiError } from "./push";
import { reconcile, type ReconcileArgs, type ReconcileReport } from "./reconcile";
import type { IngestionSink } from "./sink";
import type { EventStore } from "./store";

export interface HealArgs {
  readonly report: ReconcileReport;
  readonly customer: CustomerRef;
  /** Same window reconcile used — selects the events to re-send. */
  readonly period: Period;
  readonly cursorName?: string;
}

export interface HealSkip {
  readonly meter: string;
  readonly reason: string;
}

export interface HealReport {
  readonly customerKey: string;
  /** Meters with a positive delta whose events were re-sent. */
  readonly healedMeters: ReadonlyArray<string>;
  /** Events re-sent through the sink (includes Polar-side dedup no-ops). */
  readonly resent: number;
  /** Re-sends that were permanently rejected (4xx) and dead-lettered. */
  readonly deadLettered: number;
  /** True if a transient failure stopped the re-send partway (retry later). */
  readonly halted: boolean;
  /** Mismatches a re-flush can't fix — investigate or push meters. */
  readonly skipped: ReadonlyArray<HealSkip>;
}

/**
 * Re-send the events behind under-delivered meters. Targets exactly the
 * reconciliation basis (delivered, non-dead-lettered, in-window, this customer)
 * filtered to the meters Polar is short on.
 */
export const selfHeal = (
  store: EventStore,
  sink: IngestionSink,
  args: HealArgs,
  options: Pick<DeliverOptions, "batchSize" | "retrySchedule"> = {},
): Effect.Effect<HealReport> =>
  Effect.gen(function* () {
    const underMeters = new Set<string>();
    const skipped: HealSkip[] = [];

    for (const line of args.report.lines) {
      if (line.status === "missing-meter") {
        skipped.push({ meter: line.meter, reason: "meter not in Polar — run syncMeters (push) first" });
      } else if (line.status === "mismatch") {
        if (line.delta !== null && line.delta > 0n) {
          underMeters.add(line.meter); // Polar under-counted → re-send can fill the gap
        } else if (line.delta !== null && line.delta < 0n) {
          skipped.push({ meter: line.meter, reason: "Polar counted more than we delivered — re-flush won't help" });
        } else {
          skipped.push({ meter: line.meter, reason: "Polar total not comparable (non-integer)" });
        }
      }
    }

    if (underMeters.size === 0) {
      return { customerKey: args.report.customerKey, healedMeters: [], resent: 0, deadLettered: 0, halted: false, skipped };
    }

    const cursor = store.getCursor(args.cursorName ?? "polar");
    const deadLetterIds = new Set(store.deadLetters().map((d) => d.external_id));
    const key = customerKey(args.customer);

    const targets = store
      .all()
      .filter(
        (e) =>
          e.seq <= cursor &&
          !deadLetterIds.has(e.external_id) &&
          inPeriod(e, args.period) &&
          customerKey(e) === key &&
          underMeters.has(e.name),
      );

    const r = yield* deliver(store, sink, targets, { ...options, reason: "rejected on self-heal re-send" });

    return {
      customerKey: args.report.customerKey,
      healedMeters: [...underMeters],
      resent: r.delivered,
      deadLettered: r.deadLettered,
      halted: r.halted,
      skipped,
    };
  });

export interface ReconcileHealResult {
  readonly before: ReconcileReport;
  /** null when `before` already reconciled (nothing to heal). */
  readonly heal: HealReport | null;
  readonly after: ReconcileReport;
}

/**
 * The closed loop: reconcile → if drifted, re-send the gaps → reconcile again.
 * `after.ok` tells you whether the heal actually closed the gap (some drift —
 * negative deltas, missing meters — can't be fixed by re-sending).
 */
export const reconcileAndHeal = (
  client: PolarClient,
  sink: IngestionSink,
  store: EventStore,
  plan: Plan,
  args: ReconcileArgs,
  options: Pick<DeliverOptions, "batchSize" | "retrySchedule"> = {},
): Effect.Effect<ReconcileHealResult, PolarApiError> =>
  Effect.gen(function* () {
    const before = yield* reconcile(client, store, plan, args);
    if (before.ok) return { before, heal: null, after: before };

    const heal = yield* selfHeal(
      store,
      sink,
      { report: before, customer: args.customer, period: args.period, ...(args.cursorName ? { cursorName: args.cursorName } : {}) },
      options,
    );
    const after = yield* reconcile(client, store, plan, args);
    return { before, heal, after };
  });
