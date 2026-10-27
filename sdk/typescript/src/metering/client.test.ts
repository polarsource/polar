import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { EventInput } from "./event";
import type { CustomerMeter } from "./meter";

import { createPolar } from "../2026-10/client";
import { ClientBase, PolarError, PolarNetworkError } from "../base";
import { BufferedMeteringStrategy } from "./buffered";
import {
  Metering,
  MeteringError,
  InvalidActorError,
  type ActorInput,
  type MeteringStrategy,
  type MeteringOutpostOptions,
} from "./client";

const client = new ClientBase({
  accessToken: "token",
  baseUrl: "https://api.polar.sh",
  version: "2026-10",
});

const event = { name: "usage", external_customer_id: "alice" };

beforeEach(() => vi.stubEnv("REDIS_URL", undefined));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([false, true])("flushes supporting strategies and collects failures: %s", async (fail) => {
  const ordinary = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const error = new Error("flush failed");
  const first = {
    ...ordinary,
    flush: vi.fn(async () => {
      if (fail) throw error;
    }),
  };
  const second = { ...ordinary, flush: vi.fn().mockResolvedValue(undefined) };
  await using metering = await new Metering({
    client,
    strategies: [first, ordinary, second],
  }).start();
  if (fail) {
    await expect(metering.flush()).rejects.toMatchObject({ errors: [error] });
  } else {
    await metering.flush();
  }
  expect(first.flush).toHaveBeenCalledOnce();
  expect(second.flush).toHaveBeenCalledOnce();
  expect(ordinary.close).not.toHaveBeenCalled();
  await metering.track(event);
  expect(ordinary.track).toHaveBeenCalledTimes(3);
});

it("dates an event that carries no timestamp, once for every strategy", async () => {
  const seen: EventInput[] = [];
  const recording = (): MeteringStrategy => ({
    start: async () => {},
    track: async (tracked) => {
      seen.push(tracked);
    },
    close: async () => {},
  });
  await using metering = await new Metering({
    client,
    strategies: [recording(), recording()],
  }).start();
  const before = Date.now();
  await metering.track(event);
  await metering.track({ ...event, timestamp: "2026-10-22T08:00:00Z" });
  const [first, second, explicit] = seen;
  expect(Date.parse(first.timestamp!)).toBeGreaterThanOrEqual(before);
  expect(first.timestamp).toMatch(/Z$/);
  expect(second.timestamp).toBe(first.timestamp);
  expect(explicit.timestamp).toBe("2026-10-22T08:00:00Z");
  expect(event).not.toHaveProperty("timestamp");
});

it("waits for an active flush before closing", async () => {
  let finishFlush!: () => void;
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn(),
    flush: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFlush = resolve;
        }),
    ),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const metering = new Metering({ client, strategies: [strategy] });
  await expect(metering.flush()).rejects.toThrow("not running");
  await metering.start();
  const flushing = metering.flush();
  const closing = metering.close();
  expect(strategy.close).not.toHaveBeenCalled();
  finishFlush();
  await flushing;
  await closing;
  expect(strategy.close).toHaveBeenCalledOnce();
  await expect(metering.flush()).rejects.toThrow("not running");
});

it("starts, ingests and closes in order", async () => {
  const calls: string[] = [];
  const strategies: MeteringStrategy[] = ["buffered", "local"].map((name) => ({
    async start() {
      calls.push(`start:${name}`);
    },
    async track(value) {
      expect(value).toEqual({ ...event, timestamp: expect.any(String) });
      calls.push(`track:${name}`);
    },
    async close() {
      calls.push(`close:${name}`);
    },
  }));
  {
    await using metering = await new Metering({ client, strategies }).start();
    await metering.track(event);
  }
  expect(calls).toEqual([
    "start:buffered",
    "start:local",
    "track:buffered",
    "track:local",
    "close:buffered",
    "close:local",
  ]);
});

it.each([false, true])(
  "preserves the startup failure when cleanup fails: %s",
  async (failCleanup) => {
    const startupError = new Error("start failed");
    const cleanupError = new Error("close failed");
    const first = {
      start: vi.fn().mockResolvedValue(undefined),
      track: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const second = {
      ...first,
      close: vi.fn(async () => {
        if (failCleanup) throw cleanupError;
      }),
    };
    const third = { ...second, start: vi.fn().mockRejectedValue(startupError) };
    const metering = new Metering({ client, strategies: [first, second, third] });
    const started = metering.start();
    if (failCleanup) {
      await expect(started).rejects.toBeInstanceOf(AggregateError);
      await expect(started).rejects.toMatchObject({ errors: [startupError, cleanupError] });
    } else {
      await expect(started).rejects.toBe(startupError);
    }
    expect(second.close).toHaveBeenCalledOnce();
    expect(first.close).toHaveBeenCalledOnce();
  },
);

it("stops at the failing strategy and rejects metering outside its lifecycle", async () => {
  const first = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockRejectedValue(new Error("track failed")),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const second = { ...first, track: vi.fn() };
  const metering = new Metering({ client, strategies: [first, second] });
  await expect(metering.track(event)).rejects.toThrow("not running");
  await expect(metering.actor({ external_customer_id: "alice" })).rejects.toThrow("not running");
  await metering.start();
  await expect(metering.start()).rejects.toThrow("already started");
  await expect(metering.track(event)).rejects.toThrow("track failed");
  expect(second.track).not.toHaveBeenCalled();
  await metering.close();
  await expect(metering.track(event)).rejects.toThrow("not running");
  await expect(metering.actor({ external_customer_id: "alice" })).rejects.toThrow("not running");
});

it("rejects an event a strategy refuses before any strategy tracks it", async () => {
  const accepting = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const refusing = {
    ...accepting,
    validate: vi.fn(() => {
      throw new Error("refused");
    }),
    track: vi.fn().mockResolvedValue(undefined),
  };
  await using metering = await new Metering({ client, strategies: [accepting, refusing] }).start();
  await expect(metering.track(event)).rejects.toThrow("refused");
  expect(accepting.track).not.toHaveBeenCalled();
  expect(refusing.track).not.toHaveBeenCalled();
});

it.each<ActorInput>([
  { customer_id: "customer" },
  { customer_id: "customer", member_id: "member" },
  { external_customer_id: "customer" },
  { external_customer_id: "customer", external_member_id: "member" },
])("warms and binds an actor: %j", async (input) => {
  const ordinary = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const warmup = {
    ...ordinary,
    actor: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
  };
  await using metering = await new Metering({ client, strategies: [ordinary, warmup] }).start();
  const actor = await metering.actor(input);
  expect(warmup.actor).toHaveBeenCalledExactlyOnceWith(input);
  const payload = { name: "usage", metadata: { tokens: 3 } };
  await actor.track(payload);
  expect(ordinary.track).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ ...payload, ...input }),
  );
  expect(ordinary.track).toHaveBeenCalledOnce();
  expect(warmup.track).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ ...payload, ...input }),
  );
  expect(payload).toEqual({ name: "usage", metadata: { tokens: 3 } });
});

it.each([
  {},
  { customer_id: "customer", external_customer_id: "customer" },
  { member_id: "member" },
  { external_member_id: "member" },
  { customer_id: "customer", external_member_id: "member" },
  { external_customer_id: "customer", member_id: "member" },
])("rejects an invalid actor before warmup or metering: %j", async (input) => {
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    actor: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  await using metering = await new Metering({ client, strategies: [strategy] }).start();
  const result = metering.actor(input as unknown as ActorInput);
  await expect(result).rejects.toBeInstanceOf(InvalidActorError);
  await expect(result).rejects.toBeInstanceOf(MeteringError);
  await expect(result).rejects.toBeInstanceOf(PolarError);
  await expect(metering.track({ name: "usage", ...input } as EventInput)).rejects.toBeInstanceOf(
    InvalidActorError,
  );
  expect(strategy.actor).not.toHaveBeenCalled();
  expect(strategy.track).not.toHaveBeenCalled();
});

it("captures the actor identity before awaiting warmup", async () => {
  const input = { external_customer_id: "alice" };
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    actor: vi.fn(async () => {
      input.external_customer_id = "bob";
    }),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  await using metering = await new Metering({ client, strategies: [strategy] }).start();
  const actor = await metering.actor(input);
  await actor.track({ name: "usage", external_customer_id: "carol" } as EventInput);
  expect(strategy.track).toHaveBeenCalledExactlyOnceWith({
    name: "usage",
    external_customer_id: "alice",
    external_member_id: undefined,
    timestamp: expect.any(String),
  });
});

it.each([false, true])(
  "waits for actor warmup before closing, including failures: %s",
  async (failWarmup) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const error = new Error("warmup failed");
    const strategy = {
      start: vi.fn().mockResolvedValue(undefined),
      actor: vi.fn(async () => {
        await gate;
        if (failWarmup) throw error;
      }),
      track: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const metering = await new Metering({ client, strategies: [strategy] }).start();
    const actor = metering.actor({ external_customer_id: "alice" });
    const result = Promise.allSettled([actor]);
    const closing = metering.close();
    expect(strategy.close).not.toHaveBeenCalled();
    release();
    const [settled] = await result;
    expect(settled.status).toBe(failWarmup ? "rejected" : "fulfilled");
    if (settled.status === "rejected") expect(settled.reason).toBe(error);
    else await expect(settled.value.track({ name: "usage" })).rejects.toThrow("not running");
    await closing;
    expect(strategy.close).toHaveBeenCalledOnce();
  },
);

it("creates buffered metering using the configured HTTP client", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  const polar = createPolar({
    accessToken: "token",
    organizationId: "org",
    baseUrl: "https://custom.test",
  });
  {
    await using metering = await polar.metering().start();
    await metering.track(event);
    expect(fetch).not.toHaveBeenCalled();
  }
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe("https://custom.test/v1/events/ingest");
  const headers = new Headers(request!.headers);
  expect(headers.get("Authorization")).toBe("Bearer token");
  expect(headers.get("Polar-Organization")).toBe("org");
  expect(headers.get("Polar-Version")).toBe("2026-10");
  expect(JSON.parse(request!.body as string)).toEqual({
    events: [{ ...event, timestamp: expect.any(String) }],
  });
});

it.each<[string | undefined, boolean | MeteringOutpostOptions | undefined, string | undefined]>([
  [undefined, undefined, undefined],
  ["", undefined, undefined],
  ["redis://environment:6379", undefined, undefined],
  ["redis://environment:6379", true, "redis://environment:6379"],
  ["redis://environment:6379", {}, "redis://environment:6379"],
  ["redis://environment:6379", false, undefined],
  [undefined, { redisUrl: "redis://explicit:6379" }, "redis://explicit:6379"],
  ["redis://environment:6379", { redisUrl: "redis://explicit:6379" }, "redis://explicit:6379"],
])("resolves Outpost configuration: %s, %j", async (environment, outpost, expectedUrl) => {
  vi.stubEnv("REDIS_URL", environment);
  const { Outpost } = await import("../outpost/client");
  const start = vi
    .spyOn(Outpost.prototype, "start")
    .mockImplementation(async function (this: InstanceType<typeof Outpost>) {
      return this;
    });
  const close = vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const metering = createPolar({ accessToken: "token" }).metering({ outpost });
  vi.stubEnv("REDIS_URL", "redis://changed:6379");
  await metering.start();
  await metering.close();
  expect(metering.strategies[0]).toBeInstanceOf(BufferedMeteringStrategy);
  expect(metering.strategies).toHaveLength(expectedUrl ? 2 : 1);
  if (expectedUrl) {
    expect(start.mock.instances[0]).toMatchObject({ redisUrl: expectedUrl });
    expect(close).toHaveBeenCalledOnce();
  } else {
    expect(start).not.toHaveBeenCalled();
  }
});

it.each<true | MeteringOutpostOptions>([true, {}, { redisUrl: "" }])(
  "rejects Outpost without a Redis URL: %j",
  (outpost) => {
    expect(() => createPolar({ accessToken: "token" }).metering({ outpost })).toThrow(
      "Outpost requires redisUrl or REDIS_URL",
    );
  },
);

it.each([{ buffered: {} }, { outpost: false as const }])(
  "rejects combining strategies with built-in options: %j",
  (options) => {
    expect(() =>
      // @ts-expect-error Explicit strategies exclude built-in configuration.
      createPolar({ accessToken: "token" }).metering({ strategies: [], ...options }),
    ).toThrow("Cannot combine strategies");
  },
);

it.each([false, true])(
  "uses only explicit strategies, including an empty list: %s",
  async (empty) => {
    vi.stubEnv("REDIS_URL", "redis://environment:6379");
    const strategy = {
      start: vi.fn().mockResolvedValue(undefined),
      track: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const strategies = empty ? [] : [strategy];
    {
      await using metering = await createPolar({ accessToken: "token" })
        .metering({ strategies })
        .start();
      expect(metering.strategies).toEqual(strategies);
      await metering.track(event);
    }
    expect(strategy.start).toHaveBeenCalledTimes(empty ? 0 : 1);
    expect(strategy.track).toHaveBeenCalledTimes(empty ? 0 : 1);
    expect(strategy.close).toHaveBeenCalledTimes(empty ? 0 : 1);
  },
);

it("forwards buffer options and reports failed delivery", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const polar = createPolar({ accessToken: "token" });
  const send = vi.spyOn(polar.events, "ingest").mockRejectedValue(new PolarNetworkError("offline"));
  const onDropped = vi.fn();
  {
    await using metering = await polar
      .metering({
        buffered: { batchSize: 1, batchIntervalMs: 60_000, maxAttempts: 1, onDropped },
      })
      .start();
    await metering.track(event);
    await vi.waitFor(() =>
      expect(onDropped).toHaveBeenCalledExactlyOnceWith(
        [{ ...event, timestamp: expect.any(String) }],
        "retry_exhausted",
      ),
    );
  }
  expect(send).toHaveBeenCalledOnce();
});

it("confirms events in Outpost once Polar accepts or drops them", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { Outpost } = await import("../outpost/client");
  vi.spyOn(Outpost.prototype, "start").mockImplementation(
    async function (this: InstanceType<typeof Outpost>) {
      return this;
    },
  );
  vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  vi.spyOn(Outpost.prototype, "track").mockResolvedValue(undefined);
  const acknowledge = vi.spyOn(Outpost.prototype, "acknowledge").mockResolvedValue(undefined);
  const confirm = vi.spyOn(Outpost.prototype, "confirm").mockResolvedValue(undefined);
  const polar = createPolar({ accessToken: "token" });
  const accepted = { ...event, external_id: "accepted", timestamp: "2026-10-22T08:00:00Z" };
  const dropped = { ...accepted, external_id: "dropped" };
  vi.spyOn(polar.events, "ingest").mockImplementation(async ({ events }) => {
    if (events[0].external_id === "dropped") throw new PolarError("rejected");
    return {} as never;
  });
  const onDelivered = vi.fn();
  const onDropped = vi.fn();
  await using metering = await polar
    .metering({
      buffered: { batchSize: 1, maxAttempts: 1, onDelivered, onDropped },
      outpost: { redisUrl: "redis://localhost:6379", telemetry: false },
    })
    .start();
  await metering.track(accepted);
  await metering.track(dropped);
  await metering.flush();
  // Received events settle where their bucket is hot; dropped ones settle everywhere.
  expect(acknowledge).toHaveBeenCalledExactlyOnceWith([accepted]);
  expect(confirm).toHaveBeenCalledExactlyOnceWith([dropped]);
  expect(onDelivered).toHaveBeenCalledExactlyOnceWith([accepted]);
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([dropped], "permanent_error");
});

it("drains the buffer into Outpost before closing it", async () => {
  const calls: string[] = [];
  const { Outpost } = await import("../outpost/client");
  vi.spyOn(Outpost.prototype, "start").mockImplementation(
    async function (this: InstanceType<typeof Outpost>) {
      return this;
    },
  );
  vi.spyOn(Outpost.prototype, "close").mockImplementation(async () => {
    calls.push("close");
  });
  vi.spyOn(Outpost.prototype, "track").mockResolvedValue(undefined);
  vi.spyOn(Outpost.prototype, "acknowledge").mockImplementation(async () => {
    calls.push("acknowledge");
  });
  const polar = createPolar({ accessToken: "token" });
  vi.spyOn(polar.events, "ingest").mockResolvedValue({} as never);
  const metering = await polar
    .metering({ outpost: { redisUrl: "redis://localhost:6379", telemetry: false } })
    .start();
  await metering.track({ ...event, external_id: "last" });
  await metering.close();
  expect(calls).toEqual(["acknowledge", "close"]);
});

it("propagates Outpost startup failures and closes the buffer", async () => {
  vi.stubEnv("REDIS_URL", "redis://environment:6379");
  const { Outpost } = await import("../outpost/client");
  vi.spyOn(Outpost.prototype, "start").mockRejectedValue(new Error("Redis unavailable"));
  const close = vi.spyOn(BufferedMeteringStrategy.prototype, "close");
  await expect(
    createPolar({ accessToken: "token" }).metering({ outpost: true }).start(),
  ).rejects.toThrow("Redis unavailable");
  expect(close).toHaveBeenCalledOnce();
});

it("forwards Outpost options and actor warmup", async () => {
  const { Outpost } = await import("../outpost/client");
  vi.spyOn(Outpost.prototype, "start").mockImplementation(
    async function (this: InstanceType<typeof Outpost>) {
      return this;
    },
  );
  vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const warmup = vi.spyOn(Outpost.prototype, "actor").mockResolvedValue(undefined);
  const meter = vi.spyOn(Outpost.prototype, "meter").mockResolvedValue(null);
  const polar = createPolar({ accessToken: "token" });
  await using metering = await polar
    .metering({
      outpost: { redisUrl: "redis://localhost:6379", telemetry: false, snapshotTimeout: 250 },
    })
    .start();
  expect(vi.mocked(Outpost.prototype.start).mock.instances[0]).toMatchObject({
    options: { telemetry: false, snapshotTimeout: 250 },
  });
  const actor = await metering.actor({ external_customer_id: "alice" });
  expect(await actor.meter("meter")).toBeNull();
  expect(meter).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ external_customer_id: "alice", meter_id: "meter" }),
  );
  expect(warmup).toHaveBeenCalledExactlyOnceWith({
    external_customer_id: "alice",
    external_member_id: undefined,
  });
});

it.each([false, true])(
  "reads meters through the API when no strategy provides reads: %s",
  async (missing) => {
    const value = {
      meter_id: "meter",
      customer_id: "customer",
      consumed_units: 3,
      credited_units: 10,
      balance: 7,
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ items: missing ? [] : [value] })),
      );
    const polar = createPolar({
      accessToken: "token",
      organizationId: "org",
      baseUrl: "https://custom.test",
    });
    await using metering = await polar.metering().start();
    const actor = await metering.actor({
      external_customer_id: "external",
      external_member_id: "member",
    });
    expect(await actor.meter("meter")).toEqual(missing ? null : value);
    expect(await metering.meter("meter", { customer_id: "customer" })).toEqual(
      missing ? null : value,
    );
    expect(await metering.meter("meter", { external_customer_id: "external" })).toEqual(
      missing ? null : value,
    );
    const [rawUrl, request] = fetch.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.origin).toBe("https://custom.test");
    expect(url.pathname).toBe("/v1/customer-meters/");
    expect(url.searchParams.get("external_customer_id")).toBe("external");
    expect(url.searchParams.get("meter_id")).toBe("meter");
    expect(url.searchParams.has("external_member_id")).toBe(false);
    for (const [index, key, identity] of [
      [1, "customer_id", "customer"],
      [2, "external_customer_id", "external"],
    ] as const) {
      const directUrl = new URL(String(fetch.mock.calls[index]![0]));
      expect(directUrl.searchParams.get("meter_id")).toBe("meter");
      expect(directUrl.searchParams.get(key)).toBe(identity);
    }
    const headers = new Headers(request!.headers);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("Polar-Organization")).toBe("org");
  },
);

it.each<CustomerMeter | null | Error>([
  { meter_id: "meter", consumed_units: 3, credited_units: 10, balance: 7 },
  null,
  new Error("read failed"),
])("uses the first meter strategy without API fallback: %j", async (result) => {
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    meter: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  const second = { ...strategy, meter: vi.fn().mockResolvedValue(null) };
  await using metering = await new Metering({ client, strategies: [strategy, second] }).start();
  const actor = await metering.actor({ customer_id: "customer" });
  const read = actor.meter("meter");
  if (result instanceof Error) await expect(read).rejects.toBe(result);
  else expect(await read).toBe(result);
  expect(strategy.meter).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ customer_id: "customer", meter_id: "meter" }),
  );
  expect(second.meter).not.toHaveBeenCalled();
});

it("propagates meter API errors", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Forbidden", { status: 403 }));
  await using metering = await createPolar({ accessToken: "token" }).metering().start();
  await expect(metering.meter("meter", { customer_id: "customer" })).rejects.toThrow("403");
});

it("waits for active meter reads before closing", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    meter: vi.fn(async () => {
      await gate;
      return null;
    }),
  };
  const metering = await new Metering({ client, strategies: [strategy] }).start();
  const read = metering.meter("meter", { customer_id: "customer" });
  const closing = metering.close();
  expect(strategy.close).not.toHaveBeenCalled();
  await expect(metering.meter("meter", { customer_id: "customer" })).rejects.toThrow("not running");
  release();
  await read;
  await closing;
  expect(strategy.close).toHaveBeenCalledOnce();
});

it("aborts an in-flight HTTP delivery on shutdown", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let signal: AbortSignal | null | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
    signal = options?.signal;
    return new Promise((_, reject) =>
      signal!.addEventListener("abort", () => reject(signal!.reason), { once: true }),
    );
  });
  const polar = createPolar({ accessToken: "token" });
  const { BufferedMeteringStrategy } = await import("./buffered");
  const onDropped = vi.fn();
  const strategy = await new BufferedMeteringStrategy(polar, {
    shutdownTimeoutMs: 10,
    onDropped,
  }).start();
  await strategy.track(event);
  await strategy.close();
  expect(signal?.aborted).toBe(true);
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([event], "shutdown_timeout");
});

it("ships metering for both ESM and CommonJS", async () => {
  const esm = await import("../../dist/metering/index.mjs");
  const cjs = createRequire(import.meta.url)("../../dist/metering/index.cjs");
  expect(esm.Metering).toBeTypeOf("function");
  expect(cjs.BufferedMeteringStrategy).toBeTypeOf("function");
});

it("uses buffered metering without loading optional Outpost dependencies", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { registerHooks } from "node:module";
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "ioredis" || specifier === "ws") throw new Error("Optional dependency loaded");
      return next(specifier, context);
    }});
    const { createPolar } = await import("@polar-sh/sdk/2026-10");
    await using metering = await createPolar({ accessToken: "token" }).metering().start();
    await metering.actor({ external_customer_id: "alice" });
  `,
    ],
    { encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.status).toBe(0);
});

it.each([false, true])(
  "waits for every active track call before closing, including failed calls: %s",
  async (failTrack) => {
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const error = new Error("track failed");
    const first = {
      start: vi.fn().mockResolvedValue(undefined),
      track: vi
        .fn()
        .mockImplementationOnce(async () => {
          await firstGate;
          if (failTrack) throw error;
        })
        .mockImplementationOnce(() => secondGate),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const second = {
      ...first,
      track: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const metering = await new Metering({ client, strategies: [first, second] }).start();
    const firstTrack = metering.track(event);
    const secondTrack = metering.track(event);
    const results = Promise.allSettled([firstTrack, secondTrack]);
    const closing = metering.close();
    const closingAgain = metering.close();

    await expect(metering.track(event)).rejects.toThrow("not running");
    expect(second.close).not.toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.allSettled([firstTrack]);
    expect(second.close).not.toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();

    releaseSecond();
    const settled = await results;
    await Promise.all([closing, closingAgain]);
    expect(settled[0]).toEqual(
      failTrack ? { status: "rejected", reason: error } : { status: "fulfilled", value: undefined },
    );
    expect(settled[1].status).toBe("fulfilled");
    expect(second.track).toHaveBeenCalledTimes(failTrack ? 1 : 2);
    expect(second.close).toHaveBeenCalledOnce();
    expect(first.close).toHaveBeenCalledOnce();
  },
);
