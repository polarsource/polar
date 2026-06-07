/**
 * The event log is the single source of truth. A local event IS a Polar
 * ingestion event (same shape — see polar.ts) plus a thin internal envelope:
 *
 *   Polar fields  — name, customer (UUID *or* external), timestamp, metadata,
 *                   external_id (dedup), parent_id, organization_id, member.
 *   Internal      — seq (durable replay order), id (local handle), v (schema
 *                   version), kind (log discriminator).
 *
 * Because the event already carries everything Polar needs, forwarding is
 * almost an identity map (see sink.ts) and the local meters can aggregate over
 * `metadata` exactly the way Polar's meters do — so a local invoice preview
 * matches what Polar will bill.
 *
 * Events are append-only and carry their own timestamp; the fold never reads a
 * clock. Same events in → same invoice out.
 */
import type { EventCreateCustomer, EventCreateExternalCustomer } from "./polar";

export type Seq = number;
export type SchemaVersion = number;

/** Internal envelope added on top of the Polar event shape. */
interface Envelope {
  readonly kind: "usage";
  readonly seq: Seq;
  readonly id: string;
  readonly v: SchemaVersion;
  /** Always present after ingestion (stamped if the caller omitted it). */
  readonly timestamp: string;
}

/**
 * A stored usage event: one of Polar's two event variants + our envelope.
 * `external_id` is required here (it's our dedup / idempotency key) even though
 * Polar treats it as optional.
 */
export type UsageEvent =
  | (EventCreateCustomer & Envelope & { readonly external_id: string })
  | (EventCreateExternalCustomer & Envelope & { readonly external_id: string });

export type Event = UsageEvent;

export const isUsage = (e: Event): e is UsageEvent => e.kind === "usage";

/** Identifies a customer by Polar UUID or by your external id — the event union mirrors this. */
export type CustomerRef = { readonly customer_id: string } | { readonly external_customer_id: string };

/**
 * Stable grouping key for a customer, namespaced by which identifier is used so
 * a Polar UUID and an external id can never collide.
 */
export const customerKey = (ref: CustomerRef): string =>
  "external_customer_id" in ref ? `ext:${ref.external_customer_id}` : `cus:${ref.customer_id}`;

/** A closed time window [from, to) in epoch milliseconds. */
export interface Period {
  readonly from: number;
  readonly to: number;
}

export const inPeriod = (e: UsageEvent, p: Period): boolean => {
  const t = Date.parse(e.timestamp);
  return t >= p.from && t < p.to;
};
