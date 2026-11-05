import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import { CloudflareOutpost, MissingExternalIdError } from "./cloudflare";
import { getBucketStart, type Reducer } from "./reducer";

const timestamp = "2026-10-12T12:00:00Z";
const bucket = getBucketStart(Date.parse(timestamp) * 1000);
const customer = { external_customer_id: "alice" };
const meter = { ...customer, meter_id: "meter" };
let sequence = 0;
const eventId = () => `event-${++sequence}`;

const usageReducer = (id: string, meterId: string): Reducer => ({
  id,
  kind: "usage",
  meter_ids: [meterId],
  filter: {
    conjunction: "and",
    clauses: [{ property: "name", operator: "eq", value: "api_call" }],
  },
  aggregation: { func: "sum", property: "tokens" },
});
const creditReducer = (id: string, meterId: string): Reducer => ({
  id,
  kind: "credit",
  meter_ids: [meterId],
  filter: {
    conjunction: "and",
    clauses: [
      { property: "source", operator: "eq", value: "system" },
      { property: "name", operator: "eq", value: "meter.credited" },
      { property: "metadata.meter_id", operator: "eq", value: meterId },
    ],
  },
  aggregation: { func: "sum", property: "units" },
});
// Polar's totals of every credit granted up to the version: their cutoff is the version.
const creditSnapshot = (units: number, version: number) => ({
  cold_until: version,
  version,
  count: 1,
  sum: units,
  min: units,
  max: units,
});

// Polar's side of Outpost, behind the global fetch the Durable Objects share with the tests: the
// configuration, the snapshots, the confirmations and the changes. Each test sets what it answers.
let run = 0;
let organization = "";
let reducers: Reducer[];
let snapshot: Record<string, unknown> | undefined;
let credited = 100;
let ingested = new Set<string>();
let changes: Record<string, unknown>[] = [];
let hasMore = false;
let resetChanges = false;
let cursor = 0;
const requests: { method: string; path: string; body?: unknown }[] = [];
const requested = (path: string) =>
  requests.filter((request) => request.path.startsWith(path)).map((request) => request.body);

const identity = (reducerId: string, payload: Record<string, unknown>) => {
  const kind = reducers.find((reducer) => reducer.id === reducerId)?.kind;
  return {
    customer_id: null,
    ...customer,
    customer_exists: true,
    ...snapshot,
    ...(kind === "credit" && creditSnapshot(credited, snapshot!.version as number)),
    reducer_id: reducerId,
    ...payload,
  };
};

const answer = (method: string, path: string, body: Record<string, any> | undefined) => {
  switch (`${method} ${path}`) {
    case "GET /v1/outpost/configuration":
      return { organization_id: organization, reducers };
    case "POST /v1/outpost/meter-usage":
      return snapshot ? [identity(body!.reducer_id, {})] : [];
    case "POST /v1/outpost/confirm": {
      const { ids, ...payload } = body!;
      return {
        ...payload,
        ids: ids.filter((id: string) => ingested.has(id)),
        snapshot: identity(payload.reducer_id, {}),
      };
    }
    case "GET /v1/outpost/changes": {
      const page = {
        changes: changes.splice(0).map((change) => ({ customer_exists: true, ...change })),
        cursor: `${++cursor}-0`,
        has_more: hasMore,
        reset: resetChanges,
        configuration_changed: false,
        next_poll_in: 30,
      };
      hasMore = false;
      resetChanges = false;
      return page;
    }
    case "POST /v1/events/ingest":
      return { inserted: body!.events.length };
  }
  return undefined;
};

const polar = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  expect(url.origin).toBe("https://polar.test");
  expect(request.headers.get("authorization")).toBe("Bearer test-token");
  const text = await request.text();
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path: url.pathname + url.search, body });
  const data = answer(request.method, url.pathname, body);
  return data === undefined ? new Response(null, { status: 404 }) : Response.json(data);
};

beforeAll(() => {
  vi.stubGlobal("fetch", polar);
});

beforeEach(() => {
  // Its own organization names each test's Durable Objects: no state crosses over.
  organization = `org-${++run}`;
  reducers = [usageReducer("tokens", "meter"), creditReducer("credits", "meter")];
  snapshot = undefined;
  credited = 100;
  ingested = new Set();
  changes = [];
  hasMore = false;
  resetChanges = false;
  cursor = 0;
  requests.length = 0;
});

const outpost = () => new CloudflareOutpost(env, { organizationId: organization });
// Polar's snapshot of the usage reducer: 10 units in the cold buckets before `bucket`.
const seed = (cold = 10): void => {
  snapshot = {
    cold_until: bucket,
    version: 1791807000000001,
    count: 1,
    sum: cold,
    min: cold,
    max: cold,
  };
};
const event = (tokens: number) => ({
  ...customer,
  name: "api_call",
  external_id: eventId(),
  timestamp,
  metadata: { tokens },
});

it("reads Polar's snapshot of a cold customer once", async () => {
  seed();
  expect(await outpost().meter(meter)).toEqual({
    ...meter,
    consumed_units: 10,
    credited_units: 100,
    balance: 90,
  });
  expect((await outpost().meter(meter))?.balance).toBe(90);
  expect(requested("/v1/outpost/meter-usage")).toEqual([
    { ...customer, reducer_id: "tokens" },
    { ...customer, reducer_id: "credits" },
  ]);
});

it("reads null for a customer Polar does not know", async () => {
  expect(await outpost().meter(meter)).toBeNull();
});

it("counts a tracked event once on top of the snapshot and sends it to Polar", async () => {
  seed();
  const tracked = event(3);
  const context = createExecutionContext();
  await outpost().track(tracked, context);
  await outpost().track(tracked, context);
  expect((await outpost().meter(meter))?.consumed_units).toBe(13);
  await waitOnExecutionContext(context);
  expect(requested("/v1/events/ingest")).toEqual([{ events: [tracked] }, { events: [tracked] }]);
});

it("rejects an event without an external_id", async () => {
  await expect(outpost().track({ ...customer, name: "api_call", timestamp })).rejects.toThrow(
    MissingExternalIdError,
  );
});
