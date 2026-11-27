import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { EventInput } from "./event";

import { ClientBase } from "../base";
import { createPolar } from "../{{ (ir.versions[-2] | default(ir.versions[0])).version }}/client";
import { Outpost } from "../outpost/client";
import { NotReadyError } from "../outpost/errors";
import type { EventQueueStartOptions } from "./queue/index";
import { Metering, UnknownMeterError, type ActorInput } from "./client";

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

it("creates a memory queue using the configured HTTP client", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  const polar = createPolar({
    accessToken: "token",
    organizationId: "org",
    baseUrl: "https://custom.test",
  });
  {
    const metering = polar.metering();
    try {
      await metering.track(event);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await metering.close();
    }
  }
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe("https://custom.test/v1/events/ingest");
  const headers = new Headers(request!.headers);
  expect(headers.get("Authorization")).toBe("Bearer token");
  expect(headers.get("Polar-Organization")).toBe("org");
  expect(headers.get("Polar-Version")).toBe(
    "{{ (ir.versions[-2] | default(ir.versions[0])).version }}",
  );
  expect(JSON.parse(request!.body as string)).toEqual({
    events: [{ ...event, timestamp: expect.any(String), external_id: expect.any(String) }],
  });
});

it("enqueues before reducing and shares delivery hooks with Outpost", async () => {
  const outpost = new Outpost("redis://localhost", { client });
  vi.spyOn(outpost, "start").mockResolvedValue(outpost);
  const closeOutpost = vi.spyOn(outpost, "close").mockResolvedValue(undefined);
  const reduce = vi.spyOn(outpost, "track").mockResolvedValue(undefined);
  const ack = vi.spyOn(outpost, "onAck").mockResolvedValue(undefined);
  const reject = vi.spyOn(outpost, "onRejected").mockResolvedValue(undefined);
  const transport = {
    start: vi.fn<(options: EventQueueStartOptions) => Promise<void>>().mockResolvedValue(undefined),
    enqueue: vi.fn<(event: EventInput) => Promise<void>>().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  };
  const polar = createPolar({ accessToken: "token" });
  const onAck = vi.fn().mockRejectedValue(new Error("private event details"));
  const onRejected = vi.fn();
  const metering = polar.metering({ queue: transport, outpost: () => outpost, onAck, onRejected });
  try {
    const unavailable = new Error("private event details");
    transport.enqueue.mockRejectedValueOnce(unavailable);
    await expect(metering.track(event)).rejects.toBe(unavailable);
    expect(reduce).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reduce.mockRejectedValueOnce(unavailable);
    await metering.track(event);
    expect(warn).toHaveBeenCalledExactlyOnceWith("Outpost failed to reduce an enqueued event", "Error");
    const queued = transport.enqueue.mock.calls[1][0];
    expect(reduce).toHaveBeenCalledWith(queued);
    expect(transport.enqueue.mock.invocationCallOrder[1]).toBeLessThan(
      reduce.mock.invocationCallOrder[0],
    );
    const [hooks] = transport.start.mock.calls[0];
    await hooks?.onAck?.([queued]);
    await hooks?.onRejected?.([queued], "permanent_error");
    expect(ack).toHaveBeenCalledWith([queued]);
    expect(reject).toHaveBeenCalledWith([queued], "permanent_error");
    expect(onAck).toHaveBeenCalledWith([queued]);
    expect(onRejected).toHaveBeenCalledWith([queued], "permanent_error");
    expect(ack.mock.invocationCallOrder[0]).toBeLessThan(onAck.mock.invocationCallOrder[0]);
    expect(reject.mock.invocationCallOrder[0]).toBeLessThan(onRejected.mock.invocationCallOrder[0]);
    expect(warn).toHaveBeenLastCalledWith("Metering acknowledgement hook failed", "Error");
  } finally {
    await metering.close();
  }
  expect(transport.close.mock.invocationCallOrder[0]).toBeLessThan(
    closeOutpost.mock.invocationCallOrder[0],
  );
});

it.each([
  new NotReadyError("pending snapshot"),
  new UnknownMeterError("unknown meter"),
])("reads from Outpost and falls back to the API on %s", async (error) => {
  const polar = createPolar({ accessToken: "token" });
  const outpost = new Outpost("redis://localhost", { client });
  vi.spyOn(outpost, "start").mockResolvedValue(outpost);
  vi.spyOn(outpost, "close").mockResolvedValue(undefined);
  const local = { meter_id: "meter", consumed_units: 2, credited_units: 3, balance: 1 };
  vi.spyOn(outpost, "meter")
    .mockResolvedValueOnce(local)
    .mockRejectedValueOnce(error);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [{ ...local, balance: 0 }] })),
  );
  const metering = polar.metering({ outpost: () => outpost });
  try {
    await expect(metering.meter("meter", event)).resolves.toEqual(local);
    expect(fetch).not.toHaveBeenCalled();
    await expect(metering.meter("meter", event)).resolves.toEqual({ ...local, balance: 0 });
  } finally {
    await metering.close();
  }
});

it.each([
  {},
  { customer_id: "customer", external_customer_id: "customer" },
  { member_id: "member" },
  { external_member_id: "member" },
  { customer_id: "customer", external_member_id: "member" },
  { external_customer_id: "customer", member_id: "member" },
])("rejects an invalid actor before starting the queue: %j", async (input) => {
  const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
  const metering = new Metering(client, queue);
  try {
    await expect(metering.actor(input as unknown as ActorInput)).rejects.toBeInstanceOf(TypeError);
    await expect(metering.track({ name: "usage", ...input } as EventInput)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(queue.start).not.toHaveBeenCalled();
  } finally {
    await metering.close();
  }
});

it("propagates meter API errors", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Forbidden", { status: 403 }));
  const metering = createPolar({ accessToken: "token" }).metering();
  try {
    await expect(metering.meter("meter", { customer_id: "customer" })).rejects.toThrow("403");
  } finally {
    await metering.close();
  }
});

it("ships metering for both ESM and CommonJS", async () => {
  const esm = await import("../../dist/metering/index.mjs");
  const cjs = createRequire(import.meta.url)("../../dist/metering/index.cjs");
  expect(esm.Metering).toBeTypeOf("function");
  expect(cjs.MemoryEventQueue).toBeTypeOf("function");
});

it("uses the memory queue without loading optional Outpost dependencies", () => {
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
    const { createPolar } = await import("@polar-sh/sdk/{{ (ir.versions[-2] | default(ir.versions[0])).version }}");
    const metering = createPolar({ accessToken: "token" }).metering();
    await metering.actor({ external_customer_id: "alice" });
    await metering.close();
  `,
    ],
    { encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.status).toBe(0);
});

it("closing an unused helper does not start resources", async () => {
  const strategy = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn() };
  const metering = new Metering(client, { ...strategy, flush: vi.fn() });
  await metering.close();
  await expect(metering.flush()).rejects.toThrow("closed");
  expect(strategy.start).not.toHaveBeenCalled();
  expect(strategy.close).not.toHaveBeenCalled();
});

it("close bounds its wait for an active custom flush and still closes resources", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const strategy = {
    start: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn(() => gate),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const metering = new Metering(client, strategy);
  const flushing = metering.flush();
  try {
    await vi.waitFor(() => expect(strategy.flush).toHaveBeenCalledOnce());
    await expect(metering.close({ timeoutMs: 10 })).rejects.toThrow("timed out");
    expect(strategy.close).toHaveBeenCalledOnce();
    await expect(metering.track(event)).rejects.toThrow("closed");
  } finally {
    release();
    await flushing;
  }
});

it("startup that outlives a close deadline cleans up when it eventually completes", async () => {
  vi.spyOn(Date, "now").mockReturnValue(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const strategy = {
    start: vi.fn(() => gate),
    enqueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const metering = new Metering(client, { ...strategy, flush: vi.fn() });
  const tracking = metering.track(event).catch((error) => error);
  try {
    await expect(metering.close({ timeoutMs: 10 })).rejects.toThrow("timed out");
  } finally {
    release();
    expect(await tracking).toMatchObject({ message: expect.stringContaining("timed out") });
  }
  expect(strategy.close).toHaveBeenCalledOnce();
  expect(strategy.enqueue).not.toHaveBeenCalled();
});

it.each([-1, NaN, Infinity, 2_147_483_648])(
  "rejects invalid delivery deadlines before startup: %s",
  async (timeoutMs) => {
    const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
    const metering = new Metering(client, queue);
    await expect(metering.flush({ timeoutMs })).rejects.toBeInstanceOf(RangeError);
    await expect(metering.close({ timeoutMs })).rejects.toBeInstanceOf(RangeError);
    expect(queue.start).not.toHaveBeenCalled();
    await metering.close();
  },
);
