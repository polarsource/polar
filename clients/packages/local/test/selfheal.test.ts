import { describe, expect, test } from "bun:test";
import { Effect, Schedule } from "effect";
import { compileMeters } from "../src/compile";
import { product, perUnit } from "../src/dsl";
import type { Period, UsageEvent } from "../src/events";
import { sumOf } from "../src/meter";
import { micros } from "../src/money";
import type { Meter } from "../src/polar";
import { reconcileAndHeal, selfHeal } from "../src/selfheal";
import type { IngestionSink, SinkResult } from "../src/sink";
import { MemoryEventStore } from "../src/store";
import { fakePolarClient } from "./fake-polar";

const plan = product("api-access").meter("tokens", sumOf("amount"), perUnit(micros(2n))).build();
const period: Period = { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 1, 1) };
const customer = { external_customer_id: "acme" } as const;
const noRetry = Schedule.recurs(0);

const add = (store: MemoryEventStore, name: string, amount: number, day: number, key: string) =>
  store.append({
    name,
    external_customer_id: "acme",
    metadata: { amount },
    timestamp: new Date(Date.UTC(2026, 0, day)).toISOString(),
    external_id: key,
  });

/** Records every event re-sent, dedup'd by external_id (like Polar). */
function recordingSink() {
  const got = new Map<string, UsageEvent>();
  const sink: IngestionSink = {
    send: (events) =>
      Effect.sync((): SinkResult => {
        let dups = 0;
        for (const e of events) {
          if (got.has(e.external_id)) dups += 1;
          else got.set(e.external_id, e);
        }
        return { accepted: events.length - dups, duplicates: dups };
      }),
  };
  return { sink, got };
}

const run = <A>(eff: Effect.Effect<A, unknown>) => Effect.runPromise(eff as Effect.Effect<A, never>);

describe("selfHeal — target selection", () => {
  test("re-sends only delivered, in-window, this-customer events of under-delivered meters", () => {
    return run(
      Effect.gen(function* () {
        const store = new MemoryEventStore();
        add(store, "tokens", 100, 3, "t1");
        add(store, "tokens", 50, 9, "t2");
        add(store, "requests", 1, 9, "r1"); // different meter — must NOT be re-sent
        const dlq = add(store, "tokens", 30, 14, "t-dead");
        add(store, "tokens", 20, 20, "t-buffered"); // beyond cursor
        store.setCursor("polar", 4); // t1,t2,r1,t-dead delivered; t-buffered not
        store.deadLetter(dlq, "rejected", 0);

        const { sink, got } = recordingSink();
        const report = {
          customerKey: "ext:acme",
          watermarkSeq: 4,
          deadLettered: 1,
          ok: false,
          lines: [{ meter: "tokens", local: 150n, polar: 130n, delta: 20n, status: "mismatch" as const }],
        };

        const heal = yield* selfHeal(store, sink, { report, customer, period }, { retrySchedule: noRetry });

        expect(heal.healedMeters).toEqual(["tokens"]);
        expect([...got.keys()].sort()).toEqual(["t1", "t2"]); // not r1, t-dead, t-buffered
        expect(heal.resent).toBe(2);
      }),
    );
  });
});

describe("selfHeal — what it refuses to fix", () => {
  test("skips missing-meter (needs push) and negative-delta (Polar over-counted)", async () => {
    const store = new MemoryEventStore();
    add(store, "tokens", 100, 3, "t1");
    store.setCursor("polar", 1);
    const { sink, got } = recordingSink();
    const report = {
      customerKey: "ext:acme",
      watermarkSeq: 1,
      deadLettered: 0,
      ok: false,
      lines: [
        { meter: "tokens", local: 100n, polar: 120n, delta: -20n, status: "mismatch" as const },
        { meter: "seats", local: 3n, polar: null, delta: null, status: "missing-meter" as const },
      ],
    };
    const heal = await run(selfHeal(store, sink, { report, customer, period }, { retrySchedule: noRetry }));
    expect(heal.healedMeters).toEqual([]);
    expect(heal.resent).toBe(0);
    expect(got.size).toBe(0); // nothing re-sent
    expect(heal.skipped.map((s) => s.meter).sort()).toEqual(["seats", "tokens"]);
  });
});

describe("reconcileAndHeal — the closed loop", () => {
  /** A stateful fake Polar: the sink ingests (dedup'd), quantities read back from it. */
  function fakePolar(initial: Array<{ key: string; name: string; amount: number }>) {
    const received = new Map(initial.map((e) => [e.key, e]));
    const meters: Meter[] = compileMeters(plan).meters.map((m) => ({
      id: `m_${m.name}`,
      name: m.name,
      filter: m.filter,
      aggregation: m.aggregation,
    }));
    const sink: IngestionSink = {
      send: (events) =>
        Effect.sync((): SinkResult => {
          let dups = 0;
          for (const e of events) {
            if (received.has(e.external_id)) dups += 1;
            else received.set(e.external_id, { key: e.external_id, name: e.name, amount: Number(e.metadata?.amount ?? 0) });
          }
          return { accepted: events.length - dups, duplicates: dups };
        }),
    };
    const { client } = fakePolarClient((_method, path, opts) => {
      if (path === "/v1/meters/{id}/quantities") {
        const name = String(opts.params.path.id).replace(/^m_/, "");
        const total = [...received.values()].filter((e) => e.name === name).reduce((s, e) => s + e.amount, 0);
        return { data: { total } };
      }
      return { data: { items: meters, pagination: { max_page: 1 } } };
    });
    return { sink, client };
  }

  test("reconcile finds the gap, heal re-sends, second reconcile is clean", async () => {
    const store = new MemoryEventStore();
    add(store, "tokens", 100, 3, "t1");
    add(store, "tokens", 50, 9, "t2");
    store.setCursor("polar", 2); // both delivered locally

    // Polar only ever received t1 (a dropped event) → it'll be short by 50.
    const { sink, client } = fakePolar([{ key: "t1", name: "tokens", amount: 100 }]);

    const result = await run(
      reconcileAndHeal(client, sink, store, plan, { customer, period }, { retrySchedule: noRetry }),
    );

    expect(result.before.ok).toBe(false);
    expect(result.before.lines[0]).toMatchObject({ local: 150n, polar: 100n, delta: 50n });
    expect(result.heal?.healedMeters).toEqual(["tokens"]);
    expect(result.after.ok).toBe(true); // gap closed
    expect(result.after.lines[0]).toMatchObject({ local: 150n, polar: 150n, delta: 0n });
  });

  test("is a no-op when reconciliation is already clean", async () => {
    const store = new MemoryEventStore();
    add(store, "tokens", 100, 3, "t1");
    store.setCursor("polar", 1);
    const { sink, client } = fakePolar([{ key: "t1", name: "tokens", amount: 100 }]);
    const result = await run(reconcileAndHeal(client, sink, store, plan, { customer, period }));
    expect(result.before.ok).toBe(true);
    expect(result.heal).toBeNull();
  });
});
