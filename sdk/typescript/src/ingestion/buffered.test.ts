import { afterEach, expect, it, vi } from "vitest";

import type { EventInput } from "./event";

import {
  PolarClientError,
  PolarNetworkError,
  PolarRateLimitError,
  PolarServerError,
  type RequestOptions,
} from "../base";
import { BufferedIngestionStrategy } from "./buffered";

const events: EventInput[] = Array.from({ length: 5 }, (_, i) => ({
  name: `usage-${i}`,
  external_customer_id: "alice",
}));

afterEach(() => vi.restoreAllMocks());

it.each([0, 1, 5])("drains %i events in bounded batches on disposal", async (count) => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  {
    await using strategy = await new BufferedIngestionStrategy(
      { events: { ingest } },
      {
        batchSize: 2,
        batchIntervalMs: 60_000,
      },
    ).start();
    for (const event of events.slice(0, count)) await strategy.ingest(event);
  }
  const batches = ingest.mock.calls.map(([body]) => body.events as EventInput[]);
  expect(batches.flat()).toEqual(events.slice(0, count));
  expect(batches.every((batch) => batch.length <= 2)).toBe(true);
});

it.each(["size", "interval"])("flushes when the batch %s is reached", async (trigger) => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  await using strategy = await new BufferedIngestionStrategy(
    { events: { ingest } },
    {
      batchSize: trigger === "size" ? 1 : 100,
      batchIntervalMs: trigger === "interval" ? 10 : 60_000,
    },
  ).start();
  await strategy.ingest(events[0]);
  await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
  expect(ingest.mock.calls[0][0]).toEqual({ events: [events[0]] });
});

it("honors Retry-After and preserves the batch through retries", async () => {
  const onDropped = vi.fn();
  const ingest = vi
    .fn()
    .mockRejectedValueOnce(new PolarRateLimitError(429, 0.001))
    .mockResolvedValue(undefined);
  await using strategy = await new BufferedIngestionStrategy(
    { events: { ingest } },
    { onDropped },
  ).start();
  await strategy.ingest(events[0]);
  await strategy.close();
  expect(ingest).toHaveBeenCalledTimes(2);
  expect(ingest.mock.calls[0]).toEqual(ingest.mock.calls[1]);
  expect(onDropped).not.toHaveBeenCalled();
});

it.each([
  [new PolarNetworkError("offline"), "retry_exhausted"],
  [new PolarRateLimitError(429), "retry_exhausted"],
  [new PolarServerError(503, "unavailable"), "retry_exhausted"],
  [new PolarClientError(422, "invalid"), "permanent_error"],
] as const)("reports delivery failure: %s", async (error, reason) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockRejectedValue(error);
  const onDropped = vi.fn();
  await using strategy = await new BufferedIngestionStrategy(
    { events: { ingest } },
    { maxAttempts: 1, onDropped },
  ).start();
  await strategy.ingest(events[0]);
  await strategy.close();
  expect(ingest).toHaveBeenCalledOnce();
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([events[0]], reason);
});

it.each([false, true])(
  "reports only unfinished events at the shutdown deadline (first dropped: %s)",
  async (dropFirst) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onDropped = vi.fn();
    const ingest = vi.fn(
      async ({ events: batch }: { events: EventInput[] }, options?: RequestOptions) => {
        if (batch[0] === events[0]) {
          if (dropFirst) throw new PolarClientError(422, "invalid");
          return;
        }
        await new Promise<void>((_, reject) => {
          options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
            once: true,
          });
        });
      },
    );
    const strategy = await new BufferedIngestionStrategy(
      { events: { ingest } },
      {
        batchSize: 1,
        shutdownTimeoutMs: 10,
        onDropped,
      },
    ).start();
    for (const event of events) await strategy.ingest(event);
    await strategy.close();
    expect(onDropped.mock.calls).toEqual([
      ...(dropFirst ? [[[events[0]], "permanent_error"]] : []),
      [events.slice(1), "shutdown_timeout"],
    ]);
    expect(ingest).toHaveBeenCalledTimes(2);
  },
);

it("cancels a retry wait at the shutdown deadline", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockRejectedValue(new PolarNetworkError("offline"));
  const onDropped = vi.fn();
  const strategy = await new BufferedIngestionStrategy(
    { events: { ingest } },
    {
      shutdownTimeoutMs: 10,
      onDropped,
    },
  ).start();
  await strategy.ingest(events[0]);
  await strategy.close();
  expect(ingest).toHaveBeenCalledOnce();
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([events[0]], "shutdown_timeout");
});

it("flushes before propagating the scope error", async () => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  await expect(async () => {
    await using strategy = await new BufferedIngestionStrategy({ events: { ingest } }).start();
    await strategy.ingest(events[0]);
    throw new Error("body failed");
  }).rejects.toThrow("body failed");
  expect(ingest).toHaveBeenCalledOnce();
});

it("rejects use outside the lifecycle and propagates unexpected worker errors", async () => {
  const ingest = vi.fn().mockRejectedValue(new TypeError("broken transport"));
  const strategy = new BufferedIngestionStrategy({ events: { ingest } });
  await expect(strategy.ingest(events[0])).rejects.toThrow("not running");
  await strategy.start();
  await expect(strategy.start()).rejects.toThrow("already started");
  await strategy.ingest(events[0]);
  await expect(strategy.close()).rejects.toThrow("broken transport");
  await expect(strategy.ingest(events[0])).rejects.toThrow("broken transport");
});
