import { Redis } from "ioredis";
import { expect, it, vi } from "vitest";

import type { EventInput } from "../event";
import type { Outbox } from "./index";

import { ClientBase } from "../../base";
import { startRedisServer } from "../../outpost/testing";
import { RedisOutbox } from "./redis";

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
  const stream = "test:outbox";
  const onAck = vi.fn();
  const onRejected = vi.fn(async () => {
    expect(await redis.xlen(stream)).toBe(1);
    if (attempts.length === 1) throw new Error("Reducer unavailable");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const outbox: Outbox = new RedisOutbox(server.socket, { client, stream });
  try {
    await outbox.start({ onAck, onRejected });
    await outbox.enqueue({ name: "call", external_customer_id: "alice" });
    await outbox.flush();
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual(attempts[1]);
    expect(attempts[0].external_id).toBeTruthy();
    expect(attempts[0].timestamp).toBeTruthy();
    expect(onRejected).toHaveBeenCalledTimes(2);
    expect(onRejected).toHaveBeenCalledWith([attempts[0]], "permanent_error");
    expect(onAck).not.toHaveBeenCalled();
    expect(await redis.xlen(stream)).toBe(0);
    expect(warn).toHaveBeenCalledWith("Redis outbox drain failed", expect.any(Error));
  } finally {
    warn.mockRestore();
    await outbox.close();
    redis.disconnect();
    await server.stop();
  }
});
