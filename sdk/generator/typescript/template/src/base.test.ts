import { afterEach, describe, expect, test, vi } from "vitest";
import { ClientBase, PolarClientError, PolarNetworkError, resolveBaseUrl } from "./base";

import type { EventInput } from "./metering/event";

import { createPolar } from "./{{ (ir.versions[-2] | default(ir.versions[0])).version }}/client";
import { Outpost, outpost } from "./outpost/client";
import { NotReadyError, UnavailableRedisError } from "./outpost/errors";
import type { EventQueueStartOptions } from "./metering/queue/index";
import type { ActorInput } from "./metering/actor";
import { UnknownMeterError } from "./metering/errors";

const servers = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

describe("resolveBaseUrl", () => {
  test.each([
    ["production", undefined, "https://api.polar.sh"],
    ["sandbox", undefined, "https://sandbox-api.polar.sh"],
    ["invalid", "http://localhost:8000", "http://localhost:8000"],
  ])(
    "resolves %s with override %s",
    (environment, baseUrl, expected) => {
      expect(resolveBaseUrl(servers, environment, baseUrl)).toBe(expected);
    },
  );

  test("rejects invalid environments", () => {
    expect(() => resolveBaseUrl(servers, "invalid")).toThrow(
      'Invalid environment "invalid"',
    );
  });
});

const client = new ClientBase({
  baseUrl: "https://api.polar.sh",
  version: "2026-04",
  accessToken: "polar_at_u_xxx",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendRequest", () => {
  test("uses the client timeout in seconds", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ (ir.versions[-2] | default({})).version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest(["https://api.polar.sh/v1/items/", {}]);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {
      signal: timeoutSignal,
    });
  });

  test("uses a per-request timeout override", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ (ir.versions[-2] | default({})).version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest(
      ["https://api.polar.sh/v1/items/", {}],
      { timeout: 30 },
    );

    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  test("combines a request signal with the timeout signal", async () => {
    const requestSignal = new AbortController().signal;
    const timeoutSignal = new AbortController().signal;
    const combinedSignal = new AbortController().signal;
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const any = vi.spyOn(AbortSignal, "any").mockReturnValue(combinedSignal);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ (ir.versions[-2] | default({})).version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest([
      "https://api.polar.sh/v1/items/",
      { signal: requestSignal },
    ]);

    expect(any).toHaveBeenCalledWith([requestSignal, timeoutSignal]);
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {
      signal: combinedSignal,
    });
  });

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483.648])(
    "rejects an invalid timeout of %s seconds",
    async (timeout) => {
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

      await expect(
        client.sendRequest(
          ["https://api.polar.sh/v1/items/", {}],
          { timeout },
        ),
      ).rejects.toThrow(RangeError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("uses a per-request access token override", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "2026-04",
      accessToken: "polar_at_u_xxx",
    });
    const headers = new Headers({
      Authorization: "Bearer polar_at_u_xxx",
    });

    await client.sendRequest(
      ["https://api.polar.sh/v1/items/", { headers }],
      { accessToken: "polar_at_u_override" },
    );

    const requestHeaders = fetch.mock.calls[0][1]?.headers as Headers;
    expect(requestHeaders.get("Authorization")).toBe("Bearer polar_at_u_override");
  });

  test("does not create a timeout signal when no timeout is configured", async () => {
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ (ir.versions[-2] | default({})).version }}",
      accessToken: "polar_at_u_xxx",
      timeout: undefined,
    });

    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

    await client.sendRequest(["https://api.polar.sh/v1/items/", {}]);

    expect(timeout).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {});
  });
});

describe("buildRequest", () => {
  describe("path params", () => {
    test.each([
      [{ id: "value" }, "https://api.polar.sh/v1/items/value"],
      [{ id: 123 }, "https://api.polar.sh/v1/items/123"],
      [
        { id: "value with spaces" },
        "https://api.polar.sh/v1/items/value%20with%20spaces",
      ],
    ])(
      "builds URL with path params: %p",
      (pathParams: Record<string, string | number>, expected: string) => {
        const [url] = client.buildRequest("GET", "/v1/items/{id}", pathParams);
        expect(url).toBe(expected);
      },
    );
  });

  test("query params", () => {
    const [url] = client.buildRequest("GET", "/v1/items/", undefined, {
      string_param: "value",
      bool_param: true,
      int_param: 42,
      list_param: ["a", "b", "c"],
      dict_param: { key: "value" },
    });
    expect(url).toBe(
      "https://api.polar.sh/v1/items/?string_param=value&bool_param=true&int_param=42&list_param=a&list_param=b&list_param=c&dict_param%5Bkey%5D=value",
    );
  });

  test("deep object array query params", () => {
    const [url] = client.buildRequest("GET", "/v1/items/", undefined, {
      metadata: { reference_id: ["ABC", "DEF"] },
    });
    expect(url).toBe(
      "https://api.polar.sh/v1/items/?metadata%5Breference_id%5D=ABC&metadata%5Breference_id%5D=DEF",
    );
  });

  test("null and undefined values are ignored", () => {
    const [url] = client.buildRequest(
      "GET",
      "/v1/items/{id}",
      { id: "test" },
      { null_param: null, undefined_param: undefined, valid_param: "value" },
    );
    expect(url).toBe("https://api.polar.sh/v1/items/test?valid_param=value");
  });
});

describe("organization", () => {
  const organizationHeader = (client: ClientBase) => {
    const [, requestInit] = client.buildRequest("GET", "/v1/items/");
    return (requestInit.headers as Headers).get("Polar-Organization");
  };

  test("omits the header by default", () => {
    expect(organizationHeader(client)).toBeNull();
  });

  test("sends the configured organization", () => {
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "2026-04",
      accessToken: "polar_at_u_xxx",
      organizationId: "org_1",
    });

    expect(organizationHeader(client)).toBe("org_1");
  });
});

test("sends the SDK user agent", () => {
  const [, requestInit] = client.buildRequest("GET", "/v1/items/");

  expect((requestInit.headers as Headers).get("User-Agent")).toBe(
    "polar-sdk-typescript/{{ version }}",
  );
});

describe("parseResponse", () => {
  test.each([
    ["without Content-Type", {}],
    ["with Content-Type", { "Content-Type": "application/json" }],
  ])("returns undefined for a 202 with an empty body %s", async (_, headers) => {
    const response = new Response(null, { status: 202, headers });

    await expect(client.parseResponse(response, "json")).resolves.toBeUndefined();
  });

  test.each([
    ["json", 200],
    ["text", 200],
    ["json", 422],
  ] as const)(
    "raises a network error when a %s body of a %s fails to arrive",
    async (responseType, status) => {
      const body = new ReadableStream({
        start(controller) {
          controller.error(
            new DOMException("The operation was aborted due to timeout", "TimeoutError"),
          );
        },
      });
      const response = new Response(body, { status });
      const errors = { 422: class extends PolarClientError {} };

      await expect(client.parseResponse(response, responseType, errors)).rejects.toThrow(
        PolarNetworkError,
      );
    },
  );
});

const event = { name: "usage", external_customer_id: "alice" };

test("creates a memory queue using the configured HTTP client", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  const polar = createPolar({
    accessToken: "token",
    organizationId: "org",
    baseUrl: "https://custom.test",
  });
  try {
    await polar.actor({ external_customer_id: "alice" }).track({ name: "usage" });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await polar.close();
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

test("enqueues before reducing and shares delivery hooks with Outpost", async () => {
  vi.spyOn(Outpost.prototype, "start").mockImplementation(async function (this: Outpost) {
    return this;
  });
  const closeOutpost = vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const reduce = vi.spyOn(Outpost.prototype, "track").mockResolvedValue(undefined);
  const ack = vi.spyOn(Outpost.prototype, "onAck").mockResolvedValue(undefined);
  const reject = vi.spyOn(Outpost.prototype, "onRejected").mockResolvedValue(undefined);
  const transport = {
    start: vi.fn<(options: EventQueueStartOptions) => Promise<void>>().mockResolvedValue(undefined),
    enqueue: vi.fn<(event: EventInput) => Promise<void>>().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  };
  const onAck = vi.fn().mockRejectedValue(new Error("private event details"));
  const onRejected = vi.fn();
  const polar = createPolar({
    accessToken: "token",
    eventQueue: transport,
    outpost: outpost({ redis: "redis://localhost" }),
    onEventAck: onAck,
    onEventRejected: onRejected,
  });
  try {
    const unavailable = new Error("private event details");
    transport.enqueue.mockRejectedValueOnce(unavailable);
    await expect(polar.track(event)).rejects.toBe(unavailable);
    expect(reduce).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reduce.mockRejectedValueOnce(unavailable);
    await polar.track(event);
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
    expect(warn).toHaveBeenLastCalledWith("Event acknowledgement hook failed", "Error");
  } finally {
    await polar.close();
  }
  expect(transport.close.mock.invocationCallOrder[0]).toBeLessThan(
    closeOutpost.mock.invocationCallOrder[0],
  );
});

test.each([
  new NotReadyError("pending snapshot"),
  new UnknownMeterError("unknown meter"),
])("reads from Outpost and falls back to the API on %s", async (error) => {
  vi.spyOn(Outpost.prototype, "start").mockImplementation(async function (this: Outpost) {
    return this;
  });
  vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const local = { meter_id: "meter", consumed_units: 2, credited_units: 3, balance: 1 };
  vi.spyOn(Outpost.prototype, "meter")
    .mockResolvedValueOnce(local)
    .mockRejectedValueOnce(error);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [{ ...local, balance: 0 }] })),
  );
  const polar = createPolar({
    accessToken: "token",
    eventQueue: null,
    outpost: outpost({ redis: "redis://localhost" }),
  });
  try {
    const actor = polar.actor({ external_customer_id: "alice" });
    expect(Outpost.prototype.start).not.toHaveBeenCalled();
    await expect(actor.meter("meter")).resolves.toEqual(local);
    await expect(actor.track({ name: "usage" })).rejects.toThrow("Configure an eventQueue");
    expect(fetch).not.toHaveBeenCalled();
    await expect(polar.meter("meter", event)).resolves.toEqual({ ...local, balance: 0 });
  } finally {
    await polar.close();
  }
});

test.each([
  {},
  { customer_id: "customer", external_customer_id: "customer" },
  { member_id: "member" },
  { external_member_id: "member" },
  { customer_id: "customer", external_member_id: "member" },
  { external_customer_id: "customer", member_id: "member" },
])("rejects an invalid actor before starting the queue: %j", async (input) => {
  const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
  const polar = createPolar({ accessToken: "token", eventQueue: queue });
  try {
    expect(() => polar.actor(input as unknown as ActorInput)).toThrow(TypeError);
    await expect(polar.track({ name: "usage", ...input } as EventInput)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(queue.start).not.toHaveBeenCalled();
  } finally {
    await polar.close();
  }
});

test("propagates meter API errors without opening the delivery queue", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Forbidden", { status: 403 }));
  const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
  const polar = createPolar({ accessToken: "token", eventQueue: queue });
  try {
    await expect(polar.meter("meter", { customer_id: "customer" })).rejects.toThrow("403");
    expect(queue.start).not.toHaveBeenCalled();
  } finally {
    await polar.close();
  }
});

test("closing an unused helper does not start resources", async () => {
  const strategy = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn() };
  const polar = createPolar({ accessToken: "token", eventQueue: { ...strategy, flush: vi.fn() } });
  await polar.close();
  await expect(polar.flush()).rejects.toThrow("closed");
  expect(strategy.start).not.toHaveBeenCalled();
  expect(strategy.close).not.toHaveBeenCalled();
});

test("close bounds its wait for an active custom flush and still closes resources", async () => {
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
  const polar = createPolar({ accessToken: "token", eventQueue: strategy });
  const flushing = polar.flush();
  try {
    await vi.waitFor(() => expect(strategy.flush).toHaveBeenCalledOnce());
    await expect(polar.close({ timeoutMs: 10 })).rejects.toThrow("timed out");
    expect(strategy.close).toHaveBeenCalledOnce();
    await expect(polar.track(event)).rejects.toThrow("closed");
  } finally {
    release();
    await flushing;
  }
});

test("warms the actor's customer without starting the delivery queue", async () => {
  vi.spyOn(Outpost.prototype, "start").mockImplementation(async function (this: Outpost) {
    return this;
  });
  vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const warmup = vi.spyOn(Outpost.prototype, "actor").mockRejectedValue(
    new NotReadyError("no snapshot yet"),
  );
  const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
  const polar = createPolar({
    accessToken: "token",
    eventQueue: queue,
    outpost: outpost({ redis: "redis://localhost" }),
  });
  try {
    const actor = polar.actor({ customer_id: "alice", member_id: "member" });
    expect(warmup).not.toHaveBeenCalled();
    await actor.warmup();
    expect(warmup).toHaveBeenCalledExactlyOnceWith({ customer_id: "alice" });
    expect(queue.start).not.toHaveBeenCalled();
  } finally {
    await polar.close();
  }
});

test("propagates an Outpost startup failure without starting delivery or using the API", async () => {
  const failure = new UnavailableRedisError();
  const startOutpost = vi.spyOn(Outpost.prototype, "start").mockRejectedValue(failure);
  const fetch = vi.spyOn(globalThis, "fetch");
  const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
  const polar = createPolar({
    accessToken: "token",
    eventQueue: queue,
    outpost: outpost({ redis: "redis://localhost" }),
  });
  try {
    const actor = polar.actor({ external_customer_id: "alice" });
    await expect(actor.meter("meter")).rejects.toBe(failure);
    await expect(actor.warmup()).rejects.toBe(failure);
    await expect(polar.track(event)).rejects.toBe(failure);
    await expect(polar.flush()).rejects.toBe(failure);
    expect(startOutpost).toHaveBeenCalledOnce();
    expect(queue.start).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await polar.close();
  }
});

test("closes Outpost when the delivery queue fails to start", async () => {
  vi.spyOn(Outpost.prototype, "start").mockImplementation(async function (this: Outpost) {
    return this;
  });
  const closeOutpost = vi.spyOn(Outpost.prototype, "close").mockResolvedValue(undefined);
  const failure = new Error("queue startup failed");
  const queue = {
    start: vi.fn().mockRejectedValue(failure),
    enqueue: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  };
  const polar = createPolar({
    accessToken: "token",
    eventQueue: queue,
    outpost: outpost({ redis: "redis://localhost" }),
  });
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    await expect(polar.track(event)).rejects.toBe(failure);
    expect(closeOutpost).toHaveBeenCalledOnce();
    expect(queue.enqueue).not.toHaveBeenCalled();
    await expect(polar.flush()).rejects.toBe(failure);
    await expect(polar.meter("meter", event)).rejects.toBe(failure);
    await expect(polar.actor(event).warmup()).rejects.toBe(failure);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await polar.close();
  }
  expect(closeOutpost).toHaveBeenCalledOnce();
});

test("startup that outlives a close deadline cleans up when it eventually completes", async () => {
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
  const polar = createPolar({ accessToken: "token", eventQueue: { ...strategy, flush: vi.fn() } });
  const tracking = polar.track(event).catch((error) => error);
  try {
    await expect(polar.close({ timeoutMs: 10 })).rejects.toThrow("timed out");
  } finally {
    release();
    expect(await tracking).toMatchObject({ message: expect.stringContaining("timed out") });
  }
  expect(strategy.close).toHaveBeenCalledOnce();
  expect(strategy.enqueue).not.toHaveBeenCalled();
});

test.each([-1, NaN, Infinity, 2_147_483_648])(
  "rejects invalid delivery deadlines before startup: %s",
  async (timeoutMs) => {
    const queue = { start: vi.fn(), enqueue: vi.fn(), close: vi.fn(), flush: vi.fn() };
    const polar = createPolar({ accessToken: "token", eventQueue: queue });
    await expect(polar.flush({ timeoutMs })).rejects.toBeInstanceOf(RangeError);
    await expect(polar.close({ timeoutMs })).rejects.toBeInstanceOf(RangeError);
    expect(queue.start).not.toHaveBeenCalled();
    await polar.close();
  },
);
