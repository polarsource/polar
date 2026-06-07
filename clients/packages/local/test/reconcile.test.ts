import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { compileMeters } from "../src/compile";
import { product, perUnit } from "../src/dsl";
import type { Period } from "../src/events";
import { sumOf } from "../src/meter";
import { micros } from "../src/money";
import type { Meter } from "../src/polar";
import { deliveredQuantities, reconcile } from "../src/reconcile";
import { MemoryEventStore } from "../src/store";
import { fakePolarClient } from "./fake-polar";

const plan = product("api-access").meter("tokens", sumOf("amount"), perUnit(micros(2n))).build();
const period: Period = { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 1, 1) };
const customer = { external_customer_id: "acme" } as const;

/** Append a tokens event and return it. */
const add = (store: MemoryEventStore, amount: number, day: number, key: string) =>
  store.append({
    name: "tokens",
    external_customer_id: "acme",
    metadata: { amount },
    timestamp: new Date(Date.UTC(2026, 0, day)).toISOString(),
    external_id: key,
  });

/**
 * Build a store where only e1+e2 count toward Polar's view:
 *   e1=100, e2=50 delivered & accepted; e3=30 delivered but dead-lettered;
 *   e4=20 not yet delivered (beyond the cursor).
 * → delivered basis = 150.
 */
function scenario() {
  const store = new MemoryEventStore();
  add(store, 100, 3, "e1");
  add(store, 50, 9, "e2");
  const e3 = add(store, 30, 14, "e3");
  add(store, 20, 20, "e4");
  store.setCursor("polar", 3); // e1,e2,e3 delivered; e4 not
  store.deadLetter(e3, "rejected by Polar (4xx)", 0); // e3 never metered by Polar
  return store;
}

const fakePolar = (meters: Meter[], totals: Record<string, number>) =>
  fakePolarClient((_method, path, opts) => {
    if (path === "/v1/meters/{id}/quantities") {
      return { data: { quantities: [], total: totals[opts.params.path.id] ?? 0 } };
    }
    return { data: { items: meters, pagination: { max_page: 1 } } };
  }).client;

const polarMeters = (): Meter[] =>
  compileMeters(plan).meters.map((m) => ({ id: `m_${m.name}`, name: m.name, filter: m.filter, aggregation: m.aggregation }));

const run = <A>(eff: Effect.Effect<A, unknown>) => Effect.runPromise(eff as Effect.Effect<A, never>);

describe("deliveredQuantities (pure watermark + dead-letter exclusion)", () => {
  test("counts only events at/under the cursor, excluding dead-lettered ones", () => {
    const store = scenario();
    const deadIds = new Set(store.deadLetters().map((d) => d.external_id));
    const q = deliveredQuantities(plan, store.all(), deadIds, store.getCursor("polar"), customer, period);
    expect(q.get("tokens")).toBe(150n); // 100 + 50; e3 (DLQ) and e4 (beyond cursor) excluded
  });

  test("with the cursor at the end and nothing dead-lettered, counts everything delivered", () => {
    const store = new MemoryEventStore();
    add(store, 100, 3, "a");
    add(store, 50, 9, "b");
    store.setCursor("polar", 2);
    const q = deliveredQuantities(plan, store.all(), new Set(), 2, customer, period);
    expect(q.get("tokens")).toBe(150n);
  });
});

describe("reconcile", () => {
  test("matches when Polar's total equals the delivered basis", async () => {
    const store = scenario();
    const report = await run(reconcile(fakePolar(polarMeters(), { m_tokens: 150 }), store, plan, { customer, period }));
    expect(report.ok).toBe(true);
    expect(report.watermarkSeq).toBe(3);
    expect(report.deadLettered).toBe(1);
    expect(report.lines[0]).toMatchObject({ meter: "tokens", local: 150n, polar: 150n, delta: 0n, status: "match" });
  });

  test("flags a mismatch with the signed delta when Polar disagrees", async () => {
    const store = scenario();
    // Polar only metered 130 — we believe we delivered 150 → Polar is missing 20.
    const report = await run(reconcile(fakePolar(polarMeters(), { m_tokens: 130 }), store, plan, { customer, period }));
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toMatchObject({ local: 150n, polar: 130n, delta: 20n, status: "mismatch" });
  });

  test("reports missing-meter when the meter isn't in Polar yet (push not run)", async () => {
    const store = scenario();
    const report = await run(reconcile(fakePolar([], {}), store, plan, { customer, period })); // no meters in Polar
    expect(report.lines[0]).toMatchObject({ status: "missing-meter", polar: null, delta: null });
    expect(report.ok).toBe(false);
  });

  test("requests the right meter id, window and customer filter", async () => {
    const store = scenario();
    const { client, calls } = fakePolarClient((_method, path, opts) => {
      if (path === "/v1/meters/{id}/quantities") return { data: { total: 150 } };
      return { data: { items: polarMeters(), pagination: { max_page: 1 } } };
    });
    await run(reconcile(client, store, plan, { customer, period }));
    const q = calls.find((c) => c.path === "/v1/meters/{id}/quantities")!;
    expect(q.opts.params.path.id).toBe("m_tokens");
    expect(q.opts.params.query.external_customer_id).toBe("acme");
    expect(q.opts.params.query.start_timestamp).toBeDefined();
    expect(q.opts.params.query.end_timestamp).toBeDefined();
  });
});
