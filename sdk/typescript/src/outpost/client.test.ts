import { Redis } from "ioredis";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, access, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import type { EventsIngest } from "../2026-04/models";

import { ClientBase } from "../base";
import { Outpost } from "./client";
import { getBucketStart, type Reducer } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT } from "./scripts";

const timestamp = "2026-10-12T12:00:00Z";
const bucket = getBucketStart(Date.parse(timestamp) / 1000);
const customer = { external_customer_id: "alice" };
const meter = { ...customer, meter_id: "meter" };
const key = "outpost:state:external:alice";
let directory: string;
let redisProcess: ChildProcess;
let redis: Redis;
let server: WebSocketServer;
let core: ClientBase;
let reducers: Reducer[];
let delayConfiguration = false;
const connections: WebSocket[] = [];
const requests: unknown[] = [];
const outposts: Outpost[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "polar-outpost-"));
  const socket = join(directory, "redis.sock");
  redisProcess = spawn(
    "redis-server",
    ["--port", "0", "--unixsocket", socket, "--save", "", "--appendonly", "no"],
    { stdio: "ignore" },
  );
  let startupError: Error | undefined;
  redisProcess.on("error", (error) => {
    startupError = error;
  });
  await vi.waitFor(async () => {
    if (startupError) throw startupError;
    await access(socket);
  });
  redis = new Redis(socket);
  await once(redis, "ready");
  server = new WebSocketServer({ port: 0, host: "127.0.0.1", path: "/v1/outpost/" });
  await once(server, "listening");
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing WebSocket address");
  core = new ClientBase({
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: "test-token",
    version: "2026-10",
    organizationId: "org",
  });
  server.on("connection", (ws, request) => {
    expect(request.headers.authorization).toBe("Bearer test-token");
    expect(request.headers["polar-organization"]).toBe("org");
    connections.push(ws);
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      requests.push(message);
      if (message.type === "configuration" && !delayConfiguration)
        ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
    });
  });
});

beforeEach(async () => {
  await redis.flushdb();
  reducers = [
    {
      id: "tokens",
      meter_ids: ["meter"],
      filter: { conjunction: "and", clauses: [] },
      aggregation: { func: "sum", property: "tokens" },
    },
  ];
  requests.length = 0;
  delayConfiguration = false;
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(outposts.splice(0).map((outpost) => outpost.close()));
  connections.length = 0;
});

afterAll(async () => {
  redis?.disconnect();
  for (const ws of server?.clients ?? []) ws.terminate();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (redisProcess?.pid) {
    const exited = once(redisProcess, "exit");
    redisProcess.kill();
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

const start = async (): Promise<Outpost> => {
  const outpost = new Outpost(join(directory, "redis.sock"), { client: core });
  outposts.push(outpost);
  return outpost.start();
};
const seed = async (cold = 10): Promise<void> => {
  await redis.hset(key, { cold_until: bucket, "cold:tokens": cold, "credited:meter": 100 });
};
const ingest = (outpost: Outpost, tokens: number) => {
  const payload: EventsIngest = {
    events: [{ ...customer, name: "api_call", timestamp, metadata: { tokens } }],
  };
  return outpost.ingest(payload);
};

it.each([
  ["count", 12],
  ["sum", 12],
  ["min", -2],
  ["max", 10],
] as const)(
  "synchronizes %s with immediate writer reads and asynchronous peer reads",
  async (func, expected) => {
    reducers[0].aggregation = func === "count" ? { func } : { func, property: "tokens" };
    await seed();
    const reader = await start();
    await reader.actor(customer);
    const writer = await start();
    await ingest(writer, -2);
    await ingest(writer, 4);
    expect((await writer.customerMeter(meter))?.consumed_units).toBe(expected);
    await vi.waitFor(async () =>
      expect((await reader.customerMeter(meter))?.consumed_units).toBe(expected),
    );
    const commands = vi.spyOn(Redis.prototype, "sendCommand");
    expect((await reader.customerMeter(meter))?.balance).toBe(100 - expected);
    expect(commands).not.toHaveBeenCalled();
  },
);

it("handles configuration asynchronously with zero history and credits", async () => {
  delayConfiguration = true;
  const outpost = await start();
  const result = ingest(outpost, 3);
  for (const ws of connections)
    ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
  expect(await result).toEqual({ inserted: 1, duplicates: 0 });
  expect(await outpost.customerMeter(meter)).toEqual({
    ...meter,
    consumed_units: 3,
    credited_units: 0,
    balance: -3,
  });
  expect(await outpost.customerMeter({ ...customer, meter_id: "unknown" })).toBeNull();
});

it("propagates snapshots, removes cold buckets, and rejects older cutoffs", async () => {
  await seed();
  await redis.hset(key, { [`bucket:tokens:${bucket - 300}`]: 99, [`bucket:tokens:${bucket}`]: 3 });
  const reader = await start();
  await reader.actor(customer);
  const writer = await start();
  await writer.actor(customer);
  connections.at(-1)!.send(
    JSON.stringify({
      type: "snapshot",
      payload: { ...customer, cold_until: bucket, cold: { tokens: 8 }, credited: { meter: 100 } },
    }),
  );
  await vi.waitFor(async () => expect((await reader.customerMeter(meter))?.balance).toBe(89));
  expect(await redis.hexists(key, `bucket:tokens:${bucket - 300}`)).toBe(0);
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice",
    "outpost:0:updates",
    "unused",
    bucket - 300,
    "cold:tokens",
    1,
  );
  expect(await redis.hget(key, "cold:tokens")).toBe("8");
  await writer.ingest({
    events: [
      { ...customer, name: "api", timestamp: "2026-10-12T11:55:00Z", metadata: { tokens: 999 } },
    ],
  });
  expect((await writer.customerMeter(meter))?.balance).toBe(89);
});

it.each([
  ["count", 1],
  ["sum", 3],
  ["min", 3],
  ["max", 3],
] as const)(
  "uses zero baseline for %s without requesting a snapshot or losing local usage",
  async (func, expected) => {
    reducers[0].aggregation = func === "count" ? { func } : { func, property: "tokens" };
    const reader = await start();
    expect(await reader.customerMeter(meter)).toEqual({
      ...meter,
      consumed_units: 0,
      credited_units: 0,
      balance: 0,
    });
    const writer = await start();
    await ingest(writer, 3);
    await vi.waitFor(async () =>
      expect((await reader.customerMeter(meter))?.consumed_units).toBe(expected),
    );
    expect(requests).toEqual([{ type: "configuration" }, { type: "configuration" }]);
  },
);

it("ignores old revisions above JS integer precision and reloads on an epoch change", async () => {
  await seed();
  await redis.hset(key, { epoch: "first", revision: "9007199254740993" });
  const outpost = await start();
  await ingest(outpost, 3);
  const oldState = await redis.hgetall(key);
  const receive = outpost["receiveRedis"].bind(outpost);
  await receive(
    JSON.stringify({
      customer: "external:alice",
      state: Object.entries({
        ...oldState,
        revision: "9007199254740993",
        "cold:tokens": "1",
      }).flat(),
    }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(13);
  await redis.del(key);
  await seed(20);
  await ingest(outpost, 2);
  await receive(
    JSON.stringify({ customer: "external:alice", state: Object.entries(oldState).flat() }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(22);
});

it("repairs a missed notification on periodic refresh", async () => {
  await seed();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const outpost = await start();
  await outpost.actor(customer);
  await redis.hset(key, "cold:tokens", 20);
  await redis.hincrby(key, "revision", 1);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(async () =>
    expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20),
  );
});

it("invalidates cached state on subscriber loss and reloads after reconnect", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  const subscriber = outpost["subscriber"]!;
  const primary = outpost["redis"]!;
  const reconnect = once(subscriber, "ready");
  const primaryReconnect = once(primary, "ready");
  const closed = once(subscriber, "close");
  primary.disconnect(true);
  subscriber.disconnect(true);
  await closed;
  expect(outpost["cache"].get("external:alice")?.state).toBeUndefined();
  await redis.hset(key, "cold:tokens", 20);
  await Promise.all([reconnect, primaryReconnect]);
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20);
});

it("reloads evicted customers and closes owned connections", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  for (let i = 0; i < 1024; i++) await outpost.actor({ external_customer_id: `customer-${i}` });
  expect(outpost["cache"].size).toBe(1024);
  await redis.hset(key, "cold:tokens", 20);
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20);
  const ownedRedis = outpost["redis"]!;
  await outpost.close();
  expect(ownedRedis.status).toBe("end");
  await expect(outpost.actor(customer)).rejects.toThrow("start()");
});

it("ships the Outpost entrypoint for both ESM and CommonJS", async () => {
  const esm = await import(import.meta.resolve("@polar-sh/sdk/outpost"));
  const cjs = createRequire(import.meta.url)("@polar-sh/sdk/outpost");
  expect(esm.Outpost).toBeTypeOf("function");
  expect(cjs.Outpost).toBeTypeOf("function");
});

it("fails pending operations on malformed configuration and allows cleanup", async () => {
  delayConfiguration = true;
  const outpost = await start();
  const result = ingest(outpost, 3);
  for (const ws of connections)
    ws.send(JSON.stringify({ type: "configuration", payload: { reducers: [{}] } }));
  await expect(result).rejects.toThrow("configuration");
  await outpost.close();
  expect(outpost["cache"].size).toBe(0);
});
