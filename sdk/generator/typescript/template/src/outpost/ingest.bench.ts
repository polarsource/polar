import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { Metering } from "../metering/client";
import { RedisOutbox } from "../metering/outbox/redis";

import { BUCKET_COUNTS, COLD_UNTIL, encodeState } from "./benchmark";
import benchmark from "./benchmark.json";
import { Outpost } from "./client";
import { BUCKET_SIZE, type Reducer } from "./reducer";
import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };
// encodeState seeds every bucket with 10 events.
const SEEDED = 10;
const STREAM = "benchmark:metering:events";

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
  `outpost:v1:org:state:external:${scenario.customer}:${reducer}`;

let redisServer: RedisServer;
let redis: Redis;
let polar: PolarServer;
let metering: Metering;

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  // A warm customer has a state for every reducer: ingesting fetches none.
  for (const scenario of SCENARIOS)
    for (const reducer of REDUCERS)
      await redis.hset(stateKey(scenario, reducer.id), ...encodeState(scenario.buckets));
  polar = await startPolarServer(REDUCERS);
  metering = new Metering(
    polar.client,
    new RedisOutbox(redisServer.socket, { client: polar.client, stream: STREAM }),
    new Outpost(redisServer.socket, { client: polar.client }),
  );
  await metering.flush();
});

// Vitest runs no hook nested in a describe during benchmarks.
afterAll(async () => {
  try {
    await metering.flush();
    const stream = (await redis.xinfo("STREAM", STREAM)) as (number | string)[];
    const queued = stream[stream.indexOf("entries-added") + 1];
    if (queued !== SCENARIOS.reduce((total, scenario) => total + scenario.ingested, 0))
      throw new Error(`Unexpected stream entry count: ${queued}`);
    for (const scenario of SCENARIOS) {
      const field = `bucket:${newestBucketStart(scenario)}:count`;
      for (const reducer of scenario.reducers) {
        const count = Number(await redis.hget(stateKey(scenario, reducer), field));
        if (count !== SEEDED + scenario.ingested)
          throw new Error(`${scenario.name}: ${reducer} counted ${count - SEEDED} events`);
      }
    }
  } finally {
    await metering?.close();
    await polar?.stop();
    redis?.disconnect();
    await redisServer?.stop();
  }
});

describe("Metering.track", () => {
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
        await metering.track({ ...event, external_id: `event-${scenario.ingested}` });
        scenario.ingested += 1;
      },
      OPTIONS,
    );
  }
});
