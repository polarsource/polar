import { Redis } from "ioredis";
import { bench, describe } from "vitest";

import type { Reducer } from "./reducer";

import { ClientBase } from "../base";
import { encodeState } from "./benchmark";
import { decodeState, Outpost, type State } from "./client";

interface Reader {
  redis: Redis;
  configured: { resolve(): void };
  isSynced: boolean;
  reducers: Reducer[];
  cache: Map<
    string,
    { state?: State; pending: Promise<unknown>; missing: boolean; changed: { resolve(): void } }
  >;
  actors: Set<string>;
}

const REDUCER: Reducer = {
  id: "tokens",
  meter_ids: ["meter"],
  filter: { conjunction: "and", clauses: [] },
  aggregation: { func: "sum", property: "tokens" },
};

// Configured, synced, state cached and actor known: a read touches neither Redis nor Polar.
const outpost = new Outpost("redis://127.0.0.1:1", {
  client: new ClientBase({
    baseUrl: "http://127.0.0.1:1",
    accessToken: "bench-token",
    version: "2026-10",
  }),
  telemetry: false,
});
const reader = outpost as unknown as Reader;
reader.redis = new Redis(outpost.redisUrl, { lazyConnect: true });
reader.configured.resolve();
reader.isSynced = true;
reader.reducers = [REDUCER];
const identity = `external:alice:${REDUCER.id}`;
reader.cache.set(identity, {
  state: decodeState(encodeState(1)),
  pending: Promise.resolve(),
  missing: false,
  changed: { resolve() {} },
});
reader.actors.add(identity);

describe("meter", () => {
  bench("read a warm meter", async () => {
    await outpost.meter({ meter_id: "meter", external_customer_id: "alice" });
  });
});
