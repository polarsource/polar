import { describe, expect, test } from "vitest";
import { Effect } from "effect";
import { compileMeters } from "../src/compile";
import { product, perUnit } from "../src/dsl";
import { count, lastOf, maxOf, sumOf } from "../src/meter";
import { cents, micros } from "../src/money";
import type { Meter } from "../src/polar";
import { syncMeters } from "../src/push";
import { fakePolarClient } from "./fake-polar";

const plan = product("api-access")
  .meter("tokens", sumOf("amount"), perUnit(micros(2n)))
  .meter("requests", count(), perUnit(micros(50n)))
  .meter("seats", maxOf("amount"), perUnit(cents(500)))
  .build();

/** Existing Polar meters built straight from the compiled Plan (ids attached). */
const metersFromPlan = (): Meter[] =>
  compileMeters(plan).meters.map((m, i) => ({
    id: `m_${i}`,
    name: m.name,
    filter: m.filter,
    aggregation: m.aggregation,
  }));

/** A fake Polar that serves a fixed meter list and records create/patch calls. */
function fakePolar(existing: Meter[]) {
  const created: Array<Record<string, unknown>> = [];
  const patched: Array<{ id: string; body: Record<string, unknown> }> = [];
  const { client } = fakePolarClient((method, path, opts) => {
    if (method === "GET") return { data: { items: existing, pagination: { max_page: 1 } } };
    if (method === "POST") {
      created.push(opts.body);
      return { data: { id: "new", ...opts.body } };
    }
    if (method === "PATCH") {
      patched.push({ id: opts.params.path.id, body: opts.body });
      return { data: { ok: true } };
    }
    return { status: 400 };
  });
  return { client, created, patched };
}

const run = <A>(eff: Effect.Effect<A, unknown>) => Effect.runPromise(eff as Effect.Effect<A, never>);

describe("syncMeters", () => {
  test("creates every meter when none exist yet", async () => {
    const { client, created } = fakePolar([]);
    const report = await run(syncMeters(client, plan));
    expect(report.created).toEqual(["requests", "seats", "tokens"]);
    expect(report.unchanged).toEqual([]);
    expect(created).toHaveLength(3);
  });

  test("is idempotent — a second sync of the same Plan changes nothing", async () => {
    const { client, created, patched } = fakePolar(metersFromPlan());
    const report = await run(syncMeters(client, plan));
    expect(report.unchanged).toEqual(["requests", "seats", "tokens"]);
    expect(report.created).toEqual([]);
    expect(created).toHaveLength(0);
    expect(patched).toHaveLength(0);
  });

  test("reports drift (and does NOT mutate) when a meter's definition differs", async () => {
    const existing = metersFromPlan();
    // Pretend the live "tokens" meter aggregates a different property.
    const tokens = existing.find((m) => m.name === "tokens")!;
    existing[existing.indexOf(tokens)] = { ...tokens, aggregation: { func: "sum", property: "wrong" } };

    const { client, patched } = fakePolar(existing);
    const report = await run(syncMeters(client, plan));
    expect(report.drifted).toEqual(["tokens"]);
    expect(report.unchanged).toEqual(["requests", "seats"]);
    expect(patched).toHaveLength(0); // immutable by default
  });

  test("allowUpdate opts into PATCHing drifted meters", async () => {
    const existing = metersFromPlan();
    const tokens = existing.find((m) => m.name === "tokens")!;
    existing[existing.indexOf(tokens)] = { ...tokens, aggregation: { func: "sum", property: "wrong" } };

    const { client, patched } = fakePolar(existing);
    const report = await run(syncMeters(client, plan, { allowUpdate: true }));
    expect(report.updated).toEqual(["tokens"]);
    expect(report.drifted).toEqual([]);
    expect(patched).toHaveLength(1);
    expect(patched[0]!.id).toBe(tokens.id);
  });

  test("surfaces compiler warnings in the report", async () => {
    const p = product("p").meter("gauge", lastOf("level"), perUnit(micros(1n))).build();
    const { client } = fakePolar([]);
    const report = await run(syncMeters(client, p));
    expect(report.warnings.some((w) => w.includes('"last"'))).toBe(true);
  });
});
