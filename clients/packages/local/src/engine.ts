/**
 * The engine is a PURE FOLD: (plan, events) → state → invoice.
 *
 * No database, no clock, no I/O. Every property you asked for falls out of
 * this single constraint:
 *
 *   Determinism  — same events in, same invoice out. Nothing else is read.
 *   Auditability — each line item carries the ids of the events that made it.
 *   Time travel  — fold any subset/prefix of events to recompute history.
 *   Testability  — it's a pure function; tests are just input → expected output.
 *   Snapshots    — state is serializable, so the fold can resume from a
 *                  checkpoint instead of replaying from genesis.
 */
import type { Plan } from "./dsl";
import { priceOf } from "./dsl";
import type { CustomerRef, Period, UsageEvent } from "./events";
import { customerKey } from "./events";
import type { MeterState } from "./meter";
import { add, type Money, toCents, zero } from "./money";

/**
 * Read the metered quantity from an event's metadata. Returns null when the
 * event matches the meter's name but carries no usable value (missing property,
 * or a non-integer — which ingestion already rejects, so this is belt-and-braces).
 * `count` meters pass `property: null` and always contribute (value unused).
 */
const metricValue = (event: UsageEvent, property: string | null): bigint | null => {
  if (property === null) return 0n;
  const raw = event.metadata?.[property];
  if (typeof raw === "number" && Number.isInteger(raw)) return BigInt(raw);
  return null;
};

/** Per (customer, meter) accumulator: the meter's fold state + its audit trail. */
interface Accum {
  readonly state: MeterState;
  readonly sourceEventIds: readonly string[];
}

/**
 * The full projection. `upToSeq` records how far the fold has consumed, so a
 * snapshot is self-describing: "this is the state after event N".
 *
 * Map ordering note: we always read meters back via the plan's (sorted) line
 * order, never via Map iteration order, so the projection's internal key order
 * can never leak into an invoice.
 */
export interface EngineState {
  readonly upToSeq: number;
  readonly byCustomer: ReadonlyMap<string, ReadonlyMap<string, Accum>>;
}

export const emptyState: EngineState = { upToSeq: -1, byCustomer: new Map() };

/** Fold one event into the state. Pure: returns a new EngineState. */
export const applyEvent = (plan: Plan, state: EngineState, event: UsageEvent): EngineState => {
  // Match the event to a meter by name — exactly Polar's filter model.
  const line = plan.lines.find((l) => l.name === event.name);
  if (!line) return { ...state, upToSeq: event.seq }; // event for an unmetered name: ignore, but advance

  const value = metricValue(event, line.aggregation.property);
  if (value === null) return { ...state, upToSeq: event.seq }; // matched name but no usable metric

  const key = customerKey(event);
  const customers = new Map(state.byCustomer);
  const meters = new Map(customers.get(key) ?? new Map<string, Accum>());

  const prev = meters.get(line.name) ?? { state: line.aggregation.init, sourceEventIds: [] };
  meters.set(line.name, {
    state: line.aggregation.step(prev.state, value),
    // NOTE: storing every source id inline is O(n) memory and fine for a
    // prototype's auditability proof. A real impl would store a count + a
    // separate event index, or a rolling hash, to keep snapshots small.
    sourceEventIds: [...prev.sourceEventIds, event.id],
  });
  customers.set(key, meters);

  return { upToSeq: event.seq, byCustomer: customers };
};

/** Replay a (period-scoped, seq-ordered) event stream from empty. */
export const replay = (plan: Plan, events: readonly UsageEvent[], from = emptyState): EngineState =>
  events.reduce((s, e) => applyEvent(plan, s, e), from);

// ── Invoice projection ───────────────────────────────────────────────────────

export interface LineItem {
  readonly meter: string;
  readonly quantity: bigint;
  readonly unitPrice: Money;
  readonly amount: Money;
  readonly sourceEventIds: readonly string[];
}

export interface Invoice {
  readonly product: string;
  /** The grouping key the invoice was computed for (e.g. "ext:acme"). */
  readonly customerKey: string;
  readonly period: Period;
  readonly rulesetVersion: string;
  readonly lines: readonly LineItem[];
  readonly subtotal: Money;
  /** Whole cents — the single, explicit rounding point. */
  readonly totalCents: bigint;
}

export interface InvoiceArgs {
  /** Which customer to bill — by Polar UUID or external id (same union as events). */
  readonly customer: CustomerRef;
  readonly period: Period;
  readonly rulesetVersion: string;
}

/** Project state → invoice for one customer. Pure and deterministic. */
export const invoice = (plan: Plan, state: EngineState, args: InvoiceArgs): Invoice => {
  const key = customerKey(args.customer);
  const meters = state.byCustomer.get(key) ?? new Map<string, Accum>();

  // Iterate plan lines (already sorted by meter name) — never the Map.
  const lines: LineItem[] = plan.lines.map((line) => {
    const acc = meters.get(line.name) ?? { state: line.aggregation.init, sourceEventIds: [] };
    const quantity = line.aggregation.result(acc.state);
    const amount = priceOf(line.price, quantity);
    return {
      meter: line.name,
      quantity,
      unitPrice: line.price.price,
      amount,
      sourceEventIds: acc.sourceEventIds,
    };
  });

  const subtotal = lines.reduce<Money>((t, l) => add(t, l.amount), zero);

  return {
    product: plan.product,
    customerKey: key,
    period: args.period,
    rulesetVersion: args.rulesetVersion,
    lines,
    subtotal,
    totalCents: toCents(subtotal),
  };
};

// ── Snapshots ────────────────────────────────────────────────────────────────

/** A checkpoint of the fold. Disposable — the event log remains canonical. */
export interface Snapshot {
  readonly upToSeq: number;
  readonly byCustomer: Record<string, Record<string, { state: string | null; sourceEventIds: readonly string[] }>>;
}

export const snapshot = (state: EngineState): Snapshot => {
  const byCustomer: Snapshot["byCustomer"] = {};
  // Sort keys so the serialized snapshot is byte-stable across runs.
  for (const customerId of [...state.byCustomer.keys()].sort()) {
    const meters = state.byCustomer.get(customerId)!;
    const out: Record<string, { state: string | null; sourceEventIds: readonly string[] }> = {};
    for (const meter of [...meters.keys()].sort()) {
      const acc = meters.get(meter)!;
      out[meter] = { state: acc.state === null ? null : acc.state.toString(), sourceEventIds: acc.sourceEventIds };
    }
    byCustomer[customerId] = out;
  }
  return { upToSeq: state.upToSeq, byCustomer };
};

export const restore = (snap: Snapshot): EngineState => {
  const byCustomer = new Map<string, ReadonlyMap<string, Accum>>();
  for (const [customerId, meters] of Object.entries(snap.byCustomer)) {
    const m = new Map<string, Accum>();
    for (const [meter, acc] of Object.entries(meters)) {
      m.set(meter, { state: acc.state === null ? null : BigInt(acc.state), sourceEventIds: acc.sourceEventIds });
    }
    byCustomer.set(customerId, m);
  }
  return { upToSeq: snap.upToSeq, byCustomer };
};
