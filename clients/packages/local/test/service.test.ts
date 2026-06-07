import { describe, expect, test } from "vitest";
import { product, perUnit } from "../src/dsl";
import { sumOf } from "../src/meter";
import { micros } from "../src/money";
import { rulesetHistory } from "../src/ruleset";
import { makeHandler } from "../src/service";
import { MemoryEventStore } from "../src/store";

const history = rulesetHistory([
  {
    version: "2026.1.0",
    effectiveFrom: Date.UTC(2026, 0, 1),
    plan: product("api-access").meter("tokens", sumOf("amount"), perUnit(micros(2n))).build(),
  },
]);

const setup = () => {
  const store = new MemoryEventStore();
  return { store, handler: makeHandler({ store, history }) };
};

const post = (path: string, body: unknown) =>
  new Request(`http://x${path}`, { method: "POST", body: JSON.stringify(body) });
const get = (path: string) => new Request(`http://x${path}`);

describe("service handler", () => {
  test("POST /v1/ingest stores events and reports the count", async () => {
    const { store, handler } = setup();
    const res = await handler(
      post("/v1/ingest", {
        events: [
          { name: "tokens", external_customer_id: "acme", metadata: { amount: 1000 }, external_id: "k1" },
          { name: "tokens", external_customer_id: "acme", metadata: { amount: 500 }, external_id: "k2" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ingested: 2 });
    expect(store.all()).toHaveLength(2);
  });

  test("POST /v1/ingest rejects invalid data (non-integer metadata) with 400", async () => {
    const { store, handler } = setup();
    const res = await handler(
      post("/v1/ingest", {
        events: [{ name: "gpu", external_customer_id: "acme", metadata: { amount: 1.5 }, external_id: "bad" }],
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("must be an integer");
    expect(store.all()).toHaveLength(0);
  });

  test("GET /v1/preview computes a local invoice from the ruleset", async () => {
    const { handler } = setup();
    await handler(
      post("/v1/ingest", {
        events: [
          { name: "tokens", external_customer_id: "acme", metadata: { amount: 1_000_000 }, external_id: "k1", timestamp: "2026-01-10T00:00:00Z" },
          { name: "tokens", external_customer_id: "acme", metadata: { amount: 500_000 }, external_id: "k2", timestamp: "2026-01-20T00:00:00Z" },
        ],
      }),
    );
    const res = await handler(get("/v1/preview?customer=acme&from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z"));
    expect(res.status).toBe(200);
    const inv = (await res.json()) as { rulesetVersion: string; subtotal: string; customerKey: string };
    expect(inv.rulesetVersion).toBe("2026.1.0");
    expect(inv.customerKey).toBe("ext:acme");
    expect(inv.subtotal).toBe("3000000"); // 1,500,000 tokens × 2 µ¢ (bigint → string)
  });

  test("GET /v1/preview validates its query params", async () => {
    const { handler } = setup();
    expect((await handler(get("/v1/preview?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z"))).status).toBe(400);
    expect((await handler(get("/v1/preview?customer=acme"))).status).toBe(400);
  });

  test("GET /health reports delivery lag", async () => {
    const { store, handler } = setup();
    await handler(post("/v1/ingest", { events: [{ name: "tokens", external_customer_id: "acme", metadata: { amount: 1 }, external_id: "k1" }] }));
    store.setCursor("polar", 0); // nothing delivered yet (cursor before seq 1)
    const res = await handler(get("/health"));
    const health = (await res.json()) as { ok: boolean; events: number; undelivered: number; rulesetVersions: string[] };
    expect(health).toMatchObject({ ok: true, events: 1, undelivered: 1, rulesetVersions: ["2026.1.0"] });
  });

  test("POST /v1/reconcile returns 501 when no Polar client is configured", async () => {
    const { handler } = setup();
    const res = await handler(post("/v1/reconcile", { customer: "acme", from: "2026-01-01", to: "2026-02-01" }));
    expect(res.status).toBe(501);
  });

  test("unknown routes 404", async () => {
    const { handler } = setup();
    expect((await handler(get("/nope"))).status).toBe(404);
  });
});
