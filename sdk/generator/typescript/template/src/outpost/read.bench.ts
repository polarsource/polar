import { Redis } from "ioredis";
import { afterAll, beforeAll, bench, describe, vi } from "vitest";

import { encodeState, REDUCER } from "./benchmark";
import { Outpost } from "./client";
import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

const meter = { meter_id: "meter", external_customer_id: "alice" };

let redisServer: RedisServer;
let polar: PolarServer;
let outpost: Outpost;

beforeAll(async () => {
  // Telemetry on, as in production, with its export stubbed.
  vi.stubGlobal("fetch", async () => new Response(null, { status: 200 }));
  redisServer = await startRedisServer();
  // A snapshotted state: no read waits for Polar.
  const redis = new Redis(redisServer.socket);
  await redis.hset(`outpost:state:external:alice:${REDUCER.id}`, ...encodeState(1));
  redis.disconnect();
  polar = await startPolarServer([REDUCER]);
  outpost = await new Outpost(redisServer.socket, { client: polar.client }).start();
  if ((await outpost.meter(meter))?.credited_units !== 1_000_000)
    throw new Error("The warm read benchmark needs a ready meter");
});

afterAll(async () => {
  await outpost?.close();
  await polar?.stop();
  await redisServer?.stop();
  vi.unstubAllGlobals();
});

describe("meter", () => {
  bench("read a warm meter", async () => {
    await outpost.meter(meter);
  });
});
