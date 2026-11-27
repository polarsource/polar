import { afterAll, beforeAll, bench, describe } from "vitest";

import { CREDIT_REDUCER, REDUCER, SNAPSHOT } from "./benchmark";
import { Outpost } from "./client";
import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

const meter = { meter_id: "meter", external_customer_id: "alice" };

let redisServer: RedisServer;
let polar: PolarServer;
let outpost: Outpost;

beforeAll(async () => {
  redisServer = await startRedisServer();
  polar = await startPolarServer([REDUCER, CREDIT_REDUCER], SNAPSHOT);
  outpost = await new Outpost(redisServer.socket, { client: polar.client }).start();
  await outpost.actor({ external_customer_id: meter.external_customer_id });
  if ((await outpost.meter(meter))?.credited_units !== SNAPSHOT.sum)
    throw new Error("The warm read benchmark needs a ready meter");
});

afterAll(async () => {
  await outpost?.close();
  await polar?.stop();
  await redisServer?.stop();
});

describe("meter", () => {
  bench("read a warm meter", async () => {
    await outpost.meter(meter);
  });
});
