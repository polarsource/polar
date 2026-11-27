import { Redis } from "ioredis";
import { expect, it, vi } from "vitest";

import { ClientBase } from "../../base";
import { startRedisServer } from "../../outpost/testing";
import { createIngest } from "../event";
import type { EventInput } from "../event";
import type { EventQueue } from "./index";
import { RedisEventQueue } from "./redis";

it("skips periodic drains until the queue has work", async () => {
  const server = await startRedisServer();
  const ingest = vi.fn().mockResolvedValue(undefined);
  const onAck = vi.fn();
  const queue = new RedisEventQueue(server.socket, { stream: "test:queue" });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    await queue.start({ ingest, onAck });
    const backlog = vi.spyOn(queue["redis"]!, "queueBacklog");
    await vi.advanceTimersByTimeAsync({{ redis_constants.queue_drain_interval }});
    expect(backlog).not.toHaveBeenCalled();
    const event = {
      name: "call",
      external_customer_id: "alice",
      external_id: "event-0",
      timestamp: "2026-11-26T12:00:00Z",
    };
    await queue.enqueue(event);
    await vi.advanceTimersByTimeAsync({{ redis_constants.queue_drain_interval }});
    await vi.waitFor(() => expect(onAck).toHaveBeenCalledWith([event]));
    expect(ingest).toHaveBeenCalledExactlyOnceWith([event]);
  } finally {
    await queue.close();
    vi.useRealTimers();
    await server.stop();
  }
});

it.each([
  { newerTimeout: 30_000, returned: ["older", "newer"] },
  // A newer flush that gives up first does not release the one still waiting.
  { newerTimeout: 200, returned: ["newer timed out", "older"] },
])("releases an older flush when a newer one outlasts it ($newerTimeout ms)", async ({ newerTimeout, returned }) => {
  const server = await startRedisServer();
  let deliver!: () => void;
  const delivered = new Promise<void>((resolve) => (deliver = resolve));
  const ingest = vi.fn(() => delivered);
  const queue = new RedisEventQueue(server.socket, { stream: "test:queue" });
  const done: string[] = [];
  const flush = (name: string, timeout: number) =>
    queue.flush({ timeoutMs: timeout }).then(
      () => done.push(name),
      () => done.push(`${name} timed out`),
    );
  try {
    await queue.start({ ingest });
    await queue.enqueue({ name: "call", external_customer_id: "alice" });
    const older = flush("older", 30_000);
    await vi.waitFor(() => expect(ingest).toHaveBeenCalled());
    // A serverless instance serves many requests at once: one keeps it alive until the drain
    // ends, the others answer.
    const newer = flush("newer", newerTimeout);
    await vi.waitFor(() => expect(done).toEqual(returned.slice(0, 1)), { timeout: 1000 });
    deliver();
    await Promise.all([older, newer]);
    expect(done).toEqual(returned);
  } finally {
    deliver();
    await queue.close();
    await server.stop();
  }
});

// A serverless instance frozen while Redis dropped its connection wakes up before it sees the close.
it("queues an event on a connection Redis closed while the instance slept", async () => {
  const server = await startRedisServer();
  const redis = new Redis(server.socket);
  const queue = new RedisEventQueue(server.socket, { stream: "test:queue" });
  try {
    await queue.start({ ingest: vi.fn().mockResolvedValue(undefined) });
    queue["redis"]!.stream.destroy();
    await queue.enqueue({ name: "call", external_customer_id: "alice", external_id: "event-0" });
    expect(await redis.xlen("test:queue")).toBe(1);
  } finally {
    await queue.close();
    redis.disconnect();
    await server.stop();
  }
});

it("fails an enqueue at once while Redis is down", async () => {
  const server = await startRedisServer();
  const queue = new RedisEventQueue(server.socket, { stream: "test:queue" });
  try {
    await queue.start({ ingest: vi.fn().mockResolvedValue(undefined) });
    await server.stop();
    await vi.waitFor(() => expect(queue["redis"]!.status).not.toBe("ready"));
    const started = Date.now();
    await expect(queue.enqueue({ name: "call", external_customer_id: "alice" })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1_000);
  } finally {
    await queue.close();
  }
});

it("frees its slot once Redis comes back from a drop mid-delivery", async () => {
  const server = await startRedisServer();
  const redis = new Redis(server.socket);
  const queue = new RedisEventQueue(server.socket, { stream: "test:queue" });
  try {
    // Redis drops while Polar takes the batch: the flusher can neither acknowledge nor let go.
    await queue.start({
      ingest: async () => {
        queue["redis"]!.stream.destroy();
      },
    });
    await queue.enqueue({ name: "call", external_customer_id: "alice", external_id: "event-0" });
    await queue.flush().catch(() => {});
    await vi.waitFor(async () => expect(await redis.exists("test:queue:flusher:0")).toBe(0), {
      timeout: 2_000,
    });
  } finally {
    await queue.close();
    redis.disconnect();
    await server.stop();
  }
});

it("keeps an entry until its rejection hook succeeds", async () => {
  const server = await startRedisServer();
  const redis = new Redis(server.socket);
  const client = new ClientBase({
    baseUrl: "https://polar.test",
    accessToken: "test-token",
    version: "2026-10",
  });
  const attempts: EventInput[] = [];
  vi.spyOn(client, "sendRequest").mockImplementation(async ([url, request]) => {
    expect(new URL(url).pathname).toBe("/v1/events/ingest");
    attempts.push(JSON.parse(String(request.body)).events[0]);
    return new Response(null, { status: 422 });
  });
  const stream = "test:queue";
  const onAck = vi.fn();
  const onRejected = vi.fn(async () => {
    expect(await redis.xlen(stream)).toBe(1);
    if (attempts.length === 1) throw new Error("Reducer unavailable");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const queue: EventQueue = new RedisEventQueue(server.socket, { stream });
  try {
    await queue.start({ ingest: createIngest(client), onAck, onRejected });
    await queue.enqueue({ name: "call", external_customer_id: "alice" });
    await queue.flush();
    // Redis keeps what a drain fails to deliver: the next flush takes it.
    expect(attempts).toHaveLength(1);
    expect(await redis.xlen(stream)).toBe(1);
    await queue.flush();
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual(attempts[1]);
    expect(attempts[0].external_id).toBeTruthy();
    expect(attempts[0].timestamp).toBeTruthy();
    expect(onRejected).toHaveBeenCalledTimes(2);
    expect(onRejected).toHaveBeenCalledWith([attempts[0]], "permanent_error");
    expect(onAck).not.toHaveBeenCalled();
    expect(await redis.xlen(stream)).toBe(0);
    expect(warn).toHaveBeenCalledWith("Redis queue drain failed", expect.any(Error));
  } finally {
    warn.mockRestore();
    await queue.close();
    redis.disconnect();
    await server.stop();
  }
});
