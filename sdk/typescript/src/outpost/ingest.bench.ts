import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";
import { WebSocketServer } from "ws";

import { ClientBase } from "../base";
import { BUCKET_COUNTS, COLD_UNTIL, encodeState } from "./benchmark";
import benchmark from "./benchmark.json";
import { Outpost } from "./client";
import { BUCKET_SIZE, type Reducer } from "./reducer";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };

// Every event feeds `tokens`; an LLM call also feeds `calls` and `cost`.
const REDUCERS = benchmark.ingest.reducers as Reducer[];

const timestampOf = (bucketStart: number) => new Date(bucketStart / 1000).toISOString();

let redisServer: RedisServer;
let redis: Redis;
let server: WebSocketServer;
let outpost: Outpost;

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  for (const buckets of BUCKET_COUNTS)
    await redis.hset(`outpost:state:external:alice-${buckets}:tokens`, ...encodeState(buckets));
  for (const reducer of REDUCERS)
    await redis.hset(`outpost:state:external:bob:${reducer.id}`, ...encodeState(1));

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
  outpost = await new Outpost(redisServer.socket, { client, telemetry: false }).start();
});

afterAll(async () => {
  await outpost?.close();
  for (const ws of server?.clients ?? []) ws.terminate();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  redis?.disconnect();
  await redisServer?.stop();
});

describe("Outpost.ingest", () => {
  for (const buckets of BUCKET_COUNTS) {
    const timestamp = timestampOf(COLD_UNTIL + (buckets - 1) * BUCKET_SIZE);
    bench(
      `ingest one event into a ${buckets}-bucket state`,
      async () => {
        await outpost.ingest({
          ...benchmark.ingest.embedding,
          external_customer_id: `alice-${buckets}`,
          timestamp,
        });
      },
      OPTIONS,
    );
  }
  const timestamp = timestampOf(COLD_UNTIL);
  bench(
    "ingest one event matching three reducers",
    async () => {
      await outpost.ingest({
        ...benchmark.ingest.llm_call,
        external_customer_id: "bob",
        timestamp,
      });
    },
    OPTIONS,
  );
});
