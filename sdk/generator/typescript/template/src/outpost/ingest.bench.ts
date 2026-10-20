import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe, vi } from "vitest";
import { WebSocketServer } from "ws";

import { ClientBase } from "../base";
import { BUCKET_COUNTS, COLD_UNTIL, encodeState } from "./benchmark";
import benchmark from "./benchmark.json";
import { Outpost } from "./client";
import { BUCKET_SIZE, type Reducer } from "./reducer";
import { startRedisServer, type RedisServer } from "./testing";

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
  `outpost:state:external:${scenario.customer}:${reducer}`;

let redisServer: RedisServer;
let redis: Redis;
let server: WebSocketServer;
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

  // Polar's side of the WebSocket: the configuration, nothing else. Snapshots only matter to reads.
  server = new WebSocketServer({ port: 0, host: "127.0.0.1", path: "/v1/outpost/" });
  await once(server, "listening");
  server.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connection", payload: { id: "bench" } }));
    ws.on("message", (data) => {
      if (JSON.parse(data.toString()).type === "configuration")
        ws.send(JSON.stringify({ type: "configuration", payload: { reducers: REDUCERS } }));
    });
  });
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing WebSocket address");
  const client = new ClientBase({
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: "bench-token",
    version: "2026-10",
    organizationId: "org",
  });
  outpost = await new Outpost(redisServer.socket, { client }).start();
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
    for (const ws of server?.clients ?? []) ws.terminate();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
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
        await outpost.track(event);
        scenario.ingested += 1;
      },
      OPTIONS,
    );
  }
});
