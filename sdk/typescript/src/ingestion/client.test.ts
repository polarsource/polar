import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";

import type { EventInput } from "./event";
import type { CustomerMeter } from "./meter";

import { createPolar } from "../2026-10/client";
import { ClientBase, PolarError } from "../base";
import {
  Ingestion,
  IngestionError,
  InvalidActorError,
  type ActorInput,
  type IngestionStrategy,
} from "./client";

const client = new ClientBase({
  accessToken: "token",
  baseUrl: "https://api.polar.sh",
  version: "2026-10",
});

const event = { name: "usage", external_customer_id: "alice" };

afterEach(() => vi.restoreAllMocks());

it("starts and ingests in order, then closes in reverse order", async () => {
  const calls: string[] = [];
  const strategies: IngestionStrategy[] = ["buffered", "local"].map((name) => ({
    async start() {
      calls.push(`start:${name}`);
    },
    async ingest(value) {
      expect(value).toBe(event);
      calls.push(`ingest:${name}`);
    },
    async close() {
      calls.push(`close:${name}`);
    },
  }));
  {
    await using ingestion = await new Ingestion({ client, strategies }).start();
    await ingestion.ingest(event);
  }
  expect(calls).toEqual([
    "start:buffered",
    "start:local",
    "ingest:buffered",
    "ingest:local",
    "close:local",
    "close:buffered",
  ]);
});

it.each([false, true])(
  "preserves the startup failure when cleanup fails: %s",
  async (failCleanup) => {
    const startupError = new Error("start failed");
    const cleanupError = new Error("close failed");
    const first = {
      start: vi.fn().mockResolvedValue(undefined),
      ingest: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const second = {
      ...first,
      close: vi.fn(async () => {
        if (failCleanup) throw cleanupError;
      }),
    };
    const third = { ...second, start: vi.fn().mockRejectedValue(startupError) };
    const ingestion = new Ingestion({ client, strategies: [first, second, third] });
    const started = ingestion.start();
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

it("stops at the failing strategy and rejects ingestion outside its lifecycle", async () => {
  const first = {
    start: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockRejectedValue(new Error("ingest failed")),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const second = { ...first, ingest: vi.fn() };
  const ingestion = new Ingestion({ client, strategies: [first, second] });
  await expect(ingestion.ingest(event)).rejects.toThrow("not running");
  await expect(ingestion.actor({ external_customer_id: "alice" })).rejects.toThrow("not running");
  await ingestion.start();
  await expect(ingestion.start()).rejects.toThrow("already started");
  await expect(ingestion.ingest(event)).rejects.toThrow("ingest failed");
  expect(second.ingest).not.toHaveBeenCalled();
  await ingestion.close();
  await expect(ingestion.ingest(event)).rejects.toThrow("not running");
  await expect(ingestion.actor({ external_customer_id: "alice" })).rejects.toThrow("not running");
});

it.each<ActorInput>([
  { customer_id: "customer" },
  { customer_id: "customer", member_id: "member" },
  { external_customer_id: "customer" },
  { external_customer_id: "customer", external_member_id: "member" },
])("warms and binds an actor: %j", async (input) => {
  const ordinary = {
    start: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const warmup = {
    ...ordinary,
    actor: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockResolvedValue(undefined),
  };
  await using ingestion = await new Ingestion({ client, strategies: [ordinary, warmup] }).start();
  const actor = await ingestion.actor(input);
  expect(warmup.actor).toHaveBeenCalledExactlyOnceWith(input);
  const payload = { name: "usage", metadata: { tokens: 3 } };
  await actor.ingest(payload);
  expect(ordinary.ingest).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ ...payload, ...input }),
  );
  expect(ordinary.ingest).toHaveBeenCalledOnce();
  expect(warmup.ingest).toHaveBeenCalledExactlyOnceWith(
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
])("rejects an invalid actor before warmup or ingestion: %j", async (input) => {
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    actor: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  await using ingestion = await new Ingestion({ client, strategies: [strategy] }).start();
  const result = ingestion.actor(input as unknown as ActorInput);
  await expect(result).rejects.toBeInstanceOf(InvalidActorError);
  await expect(result).rejects.toBeInstanceOf(IngestionError);
  await expect(result).rejects.toBeInstanceOf(PolarError);
  await expect(ingestion.ingest({ name: "usage", ...input } as EventInput)).rejects.toBeInstanceOf(
    InvalidActorError,
  );
  expect(strategy.actor).not.toHaveBeenCalled();
  expect(strategy.ingest).not.toHaveBeenCalled();
});

it("captures the actor identity before awaiting warmup", async () => {
  const input = { external_customer_id: "alice" };
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    actor: vi.fn(async () => {
      input.external_customer_id = "bob";
    }),
    ingest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  await using ingestion = await new Ingestion({ client, strategies: [strategy] }).start();
  const actor = await ingestion.actor(input);
  await actor.ingest({ name: "usage", external_customer_id: "carol" } as EventInput);
  expect(strategy.ingest).toHaveBeenCalledExactlyOnceWith({
    name: "usage",
    external_customer_id: "alice",
    external_member_id: undefined,
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
      ingest: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const ingestion = await new Ingestion({ client, strategies: [strategy] }).start();
    const actor = ingestion.actor({ external_customer_id: "alice" });
    const result = Promise.allSettled([actor]);
    const closing = ingestion.close();
    expect(strategy.close).not.toHaveBeenCalled();
    release();
    const [settled] = await result;
    expect(settled.status).toBe(failWarmup ? "rejected" : "fulfilled");
    if (settled.status === "rejected") expect(settled.reason).toBe(error);
    else await expect(settled.value.ingest({ name: "usage" })).rejects.toThrow("not running");
    await closing;
    expect(strategy.close).toHaveBeenCalledOnce();
  },
);

it("creates buffered ingestion using the configured HTTP client", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  const polar = createPolar({
    accessToken: "token",
    organizationId: "org",
    baseUrl: "https://custom.test",
  });
  {
    await using ingestion = await polar.ingestion().start();
    await ingestion.ingest(event);
    expect(fetch).not.toHaveBeenCalled();
  }
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe("https://custom.test/v1/events/ingest");
  const headers = new Headers(request!.headers);
  expect(headers.get("Authorization")).toBe("Bearer token");
  expect(headers.get("Polar-Organization")).toBe("org");
  expect(headers.get("Polar-Version")).toBe("2026-10");
  expect(JSON.parse(request!.body as string)).toEqual({ events: [event] });
});

it("forwards actor warmup and meter reads to the configured Outpost", async () => {
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
  await using ingestion = await polar
    .ingestion({ outpostRedisUrl: "redis://localhost:6379" })
    .start();
  const actor = await ingestion.actor({ external_customer_id: "alice" });
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
    await using ingestion = await polar.ingestion().start();
    const actor = await ingestion.actor({
      external_customer_id: "external",
      external_member_id: "member",
    });
    expect(await actor.meter("meter")).toEqual(missing ? null : value);
    expect(await ingestion.meter({ customer_id: "customer", meter_id: "meter" })).toEqual(
      missing ? null : value,
    );
    const [rawUrl, request] = fetch.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.origin).toBe("https://custom.test");
    expect(url.pathname).toBe("/v1/customer-meters/");
    expect(url.searchParams.get("external_customer_id")).toBe("external");
    expect(url.searchParams.get("meter_id")).toBe("meter");
    expect(url.searchParams.has("external_member_id")).toBe(false);
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
    ingest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    meter: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  const second = { ...strategy, meter: vi.fn().mockResolvedValue(null) };
  await using ingestion = await new Ingestion({ client, strategies: [strategy, second] }).start();
  const actor = await ingestion.actor({ customer_id: "customer" });
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
  await using ingestion = await createPolar({ accessToken: "token" }).ingestion().start();
  await expect(ingestion.meter({ customer_id: "customer", meter_id: "meter" })).rejects.toThrow(
    "403",
  );
});

it("waits for active meter reads before closing", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    meter: vi.fn(async () => {
      await gate;
      return null;
    }),
  };
  const ingestion = await new Ingestion({ client, strategies: [strategy] }).start();
  const read = ingestion.meter({ customer_id: "customer", meter_id: "meter" });
  const closing = ingestion.close();
  expect(strategy.close).not.toHaveBeenCalled();
  await expect(ingestion.meter({ customer_id: "customer", meter_id: "meter" })).rejects.toThrow(
    "not running",
  );
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
  const { BufferedIngestionStrategy } = await import("./buffered");
  const onDropped = vi.fn();
  const strategy = await new BufferedIngestionStrategy(polar, {
    shutdownTimeoutMs: 10,
    onDropped,
  }).start();
  await strategy.ingest(event);
  await strategy.close();
  expect(signal?.aborted).toBe(true);
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([event], "shutdown_timeout");
});

it("ships ingestion for both ESM and CommonJS", async () => {
  const esm = await import("../../dist/ingestion/index.mjs");
  const cjs = createRequire(import.meta.url)("../../dist/ingestion/index.cjs");
  expect(esm.Ingestion).toBeTypeOf("function");
  expect(cjs.BufferedIngestionStrategy).toBeTypeOf("function");
});

it("uses buffered ingestion without loading optional Outpost dependencies", () => {
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
    await using ingestion = await createPolar({ accessToken: "token" }).ingestion().start();
    await ingestion.actor({ external_customer_id: "alice" });
  `,
    ],
    { encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.status).toBe(0);
});

it.each([false, true])(
  "waits for every active ingest before closing, including failed ingests: %s",
  async (failIngest) => {
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const error = new Error("ingest failed");
    const first = {
      start: vi.fn().mockResolvedValue(undefined),
      ingest: vi
        .fn()
        .mockImplementationOnce(async () => {
          await firstGate;
          if (failIngest) throw error;
        })
        .mockImplementationOnce(() => secondGate),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const second = {
      ...first,
      ingest: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const ingestion = await new Ingestion({ client, strategies: [first, second] }).start();
    const firstIngest = ingestion.ingest(event);
    const secondIngest = ingestion.ingest(event);
    const results = Promise.allSettled([firstIngest, secondIngest]);
    const closing = ingestion.close();
    const closingAgain = ingestion.close();

    await expect(ingestion.ingest(event)).rejects.toThrow("not running");
    expect(second.close).not.toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.allSettled([firstIngest]);
    expect(second.close).not.toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();

    releaseSecond();
    const settled = await results;
    await Promise.all([closing, closingAgain]);
    expect(settled[0]).toEqual(
      failIngest
        ? { status: "rejected", reason: error }
        : { status: "fulfilled", value: undefined },
    );
    expect(settled[1].status).toBe("fulfilled");
    expect(second.ingest).toHaveBeenCalledTimes(failIngest ? 1 : 2);
    expect(second.close).toHaveBeenCalledOnce();
    expect(first.close).toHaveBeenCalledOnce();
  },
);
