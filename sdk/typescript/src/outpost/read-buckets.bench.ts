import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe, vi } from "vitest";

import { BUCKET_COUNTS, REDUCER, SNAPSHOT, encodeState } from "./benchmark";
import { Outpost } from "./client";
import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

const customerOf = (buckets: number) => `alice-${buckets}`;
const meterOf = (buckets: number) => ({
  meter_id: "meter",
  external_customer_id: customerOf(buckets),
});
// The seeded cold sum plus the sum of every local bucket encodeState writes.
const consumedOf = (buckets: number) =>
  SNAPSHOT.sum + 100 * buckets + (buckets * (buckets - 1)) / 2;

let redisServer: RedisServer;
let polar: PolarServer;
let outpost: Outpost;

beforeAll(async () => {
  // Telemetry on, as in production, with its export stubbed.
  vi.stubGlobal("fetch", async () => new Response(null, { status: 200 }));
  redisServer = await startRedisServer();
  // Local buckets since the snapshot, as earlier writers leave them; the snapshot keeps them.
  const redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  for (const buckets of BUCKET_COUNTS)
    await redis.hset(
      `outpost:v1:state:external:${customerOf(buckets)}:${REDUCER.id}`,
      ...encodeState(buckets),
    );
  redis.disconnect();
  polar = await startPolarServer([REDUCER], SNAPSHOT);
  outpost = await new Outpost(redisServer.socket, { client: polar.client }).start();
  for (const buckets of BUCKET_COUNTS) {
    await outpost.actor({ external_customer_id: customerOf(buckets) });
    if ((await outpost.meter(meterOf(buckets)))?.consumed_units !== consumedOf(buckets))
      throw new Error(`The warm read benchmark needs ${buckets} local buckets`);
  }
});

afterAll(async () => {
  await outpost?.close();
  await polar?.stop();
  await redisServer?.stop();
  vi.unstubAllGlobals();
});

describe("meter", () => {
  for (const buckets of BUCKET_COUNTS) {
    const meter = meterOf(buckets);
    bench(`read a warm meter over ${buckets} local buckets`, async () => {
      await outpost.meter(meter);
    });
  }
});
