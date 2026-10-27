import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe, vi } from "vitest";

import { BUCKET_COUNTS, COLD_UNTIL, encodeState } from "./benchmark";
import benchmark from "./benchmark.json";
import { Outpost } from "./client";
import { BUCKET_SIZE, type Reducer } from "./reducer";
import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };
// encodeState seeds every bucket with 10 events.
const SEEDED = 10;

// Every event feeds `tokens`; an LLM call also feeds `calls` and `cost`.
const REDUCERS = benchmark.ingest.reducers as Reducer[];

interface Scenario {
  name: string;
  customer: string;
  buckets: number;
  event: { name: string; metadata: Record<string, number> };
  reducers: string[];
  ingested: number;
}

const SCENARIOS: Scenario[] = [
  ...BUCKET_COUNTS.map((buckets) => ({
    name: `ingest one event into a ${buckets}-bucket state`,
    customer: `alice-${buckets}`,
    buckets,
    event: benchmark.ingest.embedding,
    reducers: ["tokens"],
    ingested: 0,
  })),
  {
    name: "ingest one event matching three reducers",
    customer: "bob",
    buckets: 1,
    event: benchmark.ingest.llm_call,
    reducers: REDUCERS.map((reducer) => reducer.id),
    ingested: 0,
  },
];

const newestBucketStart = (scenario: Scenario) => COLD_UNTIL + (scenario.buckets - 1) * BUCKET_SIZE;
const stateKey = (scenario: Scenario, reducer: string) =>
  `outpost:v1:state:external:${scenario.customer}:${reducer}`;

let redisServer: RedisServer;
let redis: Redis;
let polar: PolarServer;
let outpost: Outpost;

beforeAll(async () => {
  // Telemetry records as in production; only its export to Polar stays on the machine.
  vi.stubGlobal("fetch", async () => new Response(null, { status: 200 }));
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  for (const scenario of SCENARIOS)
    for (const reducer of scenario.reducers)
      await redis.hset(stateKey(scenario, reducer), ...encodeState(scenario.buckets));
  polar = await startPolarServer(REDUCERS);
  outpost = await new Outpost(redisServer.socket, { client: polar.client }).start();
});

// Vitest runs no hook nested in a describe during benchmarks.
afterAll(async () => {
  try {
    for (const scenario of SCENARIOS) {
      const field = `bucket:${newestBucketStart(scenario)}:count`;
      for (const reducer of scenario.reducers) {
        const count = Number(await redis.hget(stateKey(scenario, reducer), field));
        if (count !== SEEDED + scenario.ingested)
          throw new Error(`${scenario.name}: ${reducer} counted ${count - SEEDED} events`);
      }
    }
  } finally {
    await outpost?.close();
    await polar?.stop();
    redis?.disconnect();
    await redisServer?.stop();
    vi.unstubAllGlobals();
  }
});

describe("Outpost.track", () => {
  for (const scenario of SCENARIOS) {
    const event = {
      ...scenario.event,
      external_customer_id: scenario.customer,
      timestamp: new Date(newestBucketStart(scenario) / 1000).toISOString(),
    };
    bench(
      scenario.name,
      async () => {
        // Every call carries its own external_id, as production events do.
        await outpost.track({ ...event, external_id: `event-${scenario.ingested}` });
        scenario.ingested += 1;
      },
      OPTIONS,
    );
  }
});
