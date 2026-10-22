import { afterEach, expect, it, vi } from "vitest";

import type { EventInput } from "./event";

import {
  PolarClientError,
  PolarNetworkError,
  PolarRateLimitError,
  PolarServerError,
  type RequestOptions,
} from "../base";
import { BufferedMeteringStrategy } from "./buffered";

const events: EventInput[] = Array.from({ length: 5 }, (_, i) => ({
  name: `usage-${i}`,
  external_customer_id: "alice",
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("flushes empty and bounded batches, then accepts more events", async () => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  const strategy = new BufferedMeteringStrategy(
    { events: { ingest } },
    { batchSize: 2, batchIntervalMs: 60_000 },
  );
  await expect(strategy.track(events[0])).rejects.toThrow("not running");
  await expect(strategy.flush()).rejects.toThrow("not running");
  await strategy.start();
  await expect(strategy.start()).rejects.toThrow("already started");
  await strategy.flush();
  expect(ingest).not.toHaveBeenCalled();
  for (const event of events) await strategy.track(event);
  await strategy.flush();
  expect(ingest.mock.calls.map(([body]) => body.events)).toEqual([
    events.slice(0, 2),
    events.slice(2, 4),
    events.slice(4),
  ]);
  await strategy.track(events[0]);
  await strategy.flush();
  expect(ingest).toHaveBeenCalledTimes(4);
  await strategy.close();
  await expect(strategy.flush()).rejects.toThrow("not running");
});

it("starts the batch interval with the first event without resetting it", async () => {
  vi.useFakeTimers();
  const ingest = vi.fn().mockResolvedValue(undefined);
  await using strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { batchIntervalMs: 100 },
  ).start();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(50);
  await strategy.track(events[0]);
  await vi.advanceTimersByTimeAsync(50);
  await strategy.track(events[1]);
  expect(ingest).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);
  expect(ingest).toHaveBeenCalledExactlyOnceWith({ events: events.slice(0, 2) }, expect.anything());
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps concurrent flush boundaries separate while a batch is in flight", async () => {
  let finishDelivery!: () => void;
  const ingest = vi.fn(
    (_body: { events: EventInput[] }) =>
      new Promise<void>((resolve) => {
        finishDelivery = resolve;
      }),
  );
  await using strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { batchSize: 1 },
  ).start();
  try {
    await strategy.track(events[0]);
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
    const firstDone = vi.fn();
    const firstFlush = strategy.flush().then(firstDone);
    await strategy.track(events[1]);
    const secondDone = vi.fn();
    const secondFlush = strategy.flush().then(secondDone);
    const closed = vi.fn();
    const closing = strategy.close().then(closed);
    await expect(strategy.flush()).rejects.toThrow("not running");
    expect(firstDone).not.toHaveBeenCalled();
    finishDelivery();
    await firstFlush;
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));
    expect(secondDone).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    finishDelivery();
    await Promise.all([secondFlush, closing]);
    expect(ingest.mock.calls.map(([body]) => body.events)).toEqual([[events[0]], [events[1]]]);
  } finally {
    ingest.mockResolvedValue(undefined);
    finishDelivery();
  }
});

it.each([
  { batchSize: 100, batches: [[1, 2, 3]] },
  { batchSize: 2, batches: [[1, 2], [3]] },
])(
  "batches events queued behind pending flushes (batch size $batchSize)",
  async ({ batchSize, batches }) => {
    const deliveries: (() => void)[] = [];
    const ingest = vi.fn(
      (_body: { events: EventInput[] }) =>
        new Promise<void>((resolve) => {
          deliveries.push(resolve);
        }),
    );
    await using strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      { batchSize, batchIntervalMs: 60_000 },
    ).start();
    try {
      await strategy.track(events[0]);
      const first = strategy.flush();
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
      const flushed = [1, 2, 3].map(() => vi.fn());
      const flushes: Promise<void>[] = [];
      for (const [index, event] of events.slice(1, 4).entries()) {
        await strategy.track(event);
        flushes.push(strategy.flush().then(flushed[index]));
      }
      deliveries.shift()!();
      await first;
      let delivered = 0;
      for (const [index, batch] of batches.entries()) {
        await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(index + 2));
        expect(ingest.mock.calls[index + 1][0].events).toEqual(batch.map((i) => events[i]));
        expect(flushed.filter((done) => done.mock.calls.length)).toHaveLength(delivered);
        deliveries.shift()!();
        delivered += batch.length;
        await Promise.all(flushes.slice(0, delivered));
      }
      expect(ingest).toHaveBeenCalledTimes(batches.length + 1);
    } finally {
      ingest.mockResolvedValue(undefined);
      for (const finishDelivery of deliveries) finishDelivery();
    }
  },
);

it.each(["shutdown timeout", "worker error"])(
  "rejects active and queued flushes on %s",
  async (failure) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let failDelivery!: (error: Error) => void;
    const ingest = vi.fn(async (_body: unknown, options?: RequestOptions) => {
      await new Promise<void>((_, reject) => {
        failDelivery = reject;
        options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
          once: true,
        });
      });
    });
    const onDropped = vi.fn();
    const strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      { batchIntervalMs: 60_000, shutdownTimeoutMs: 10, onDropped },
    ).start();
    await strategy.track(events[0]);
    const firstFlush = strategy.flush();
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
    await strategy.track(events[1]);
    const flushes = Promise.allSettled([firstFlush, strategy.flush()]);
    const error = failure === "worker error" ? "broken transport" : "shutdown timed out";
    if (failure === "worker error") {
      failDelivery(new TypeError(error));
      await expect(strategy.close()).rejects.toThrow(error);
      await expect(strategy.flush()).rejects.toThrow(error);
      await expect(strategy.track(events[0])).rejects.toThrow(error);
      expect(onDropped).not.toHaveBeenCalled();
    } else {
      await strategy.close();
      expect(onDropped).toHaveBeenCalledExactlyOnceWith(events.slice(0, 2), "shutdown_timeout");
    }
    for (const result of await flushes) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: { message: expect.stringContaining(error) },
      });
    }
  },
);

it.each([0, 1, 5])("drains %i events in bounded batches on disposal", async (count) => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  {
    await using strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      { batchSize: 2, batchIntervalMs: 60_000 },
    ).start();
    for (const event of events.slice(0, count)) await strategy.track(event);
  }
  const batches = ingest.mock.calls.map(([body]) => body.events as EventInput[]);
  expect(batches.flat()).toEqual(events.slice(0, count));
  expect(batches.every((batch) => batch.length <= 2)).toBe(true);
});

it.each([
  { batchSize: 1, batchIntervalMs: 60_000 },
  { batchSize: 100, batchIntervalMs: 0 },
])(
  "automatically sends with batch size $batchSize and interval $batchIntervalMs",
  async (options) => {
    const ingest = vi.fn().mockResolvedValue(undefined);
    await using strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      options,
    ).start();
    await strategy.track(events[0]);
    await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
    expect(ingest.mock.calls[0][0]).toEqual({ events: [events[0]] });
  },
);

it("honors Retry-After and preserves the batch through retries", async () => {
  const onDropped = vi.fn();
  const ingest = vi
    .fn()
    .mockRejectedValueOnce(new PolarRateLimitError(429, 0.001))
    .mockResolvedValue(undefined);
  await using strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { onDropped },
  ).start();
  await strategy.track(events[0]);
  await strategy.flush();
  expect(ingest).toHaveBeenCalledTimes(2);
  expect(ingest.mock.calls[0]).toEqual(ingest.mock.calls[1]);
  expect(onDropped).not.toHaveBeenCalled();
});

it("waits at least a second on Retry-After without spending attempts", async () => {
  const onDropped = vi.fn();
  const calls: number[] = [];
  const ingest = vi.fn(async () => {
    calls.push(performance.now());
    if (calls.length === 1) throw new PolarRateLimitError(429, 0);
  });
  await using strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { maxAttempts: 1, onDropped },
  ).start();
  await strategy.track(events[0]);
  await strategy.flush();
  expect(calls).toHaveLength(2);
  expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(900);
  expect(onDropped).not.toHaveBeenCalled();
});

it(
  "drops the batch when Retry-After exceeds the wait budget",
  async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onDropped = vi.fn();
    const ingest = vi.fn().mockRejectedValue(new PolarRateLimitError(429, 301));
    await using strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      { shutdownTimeoutMs: 10, onDropped },
    ).start();
    await strategy.track(events[0]);
    await strategy.flush();
    expect(ingest).toHaveBeenCalledOnce();
    expect(onDropped).toHaveBeenCalledExactlyOnceWith([events[0]], "retry_exhausted");
  },
  500,
);

it.each([
  [new PolarNetworkError("offline"), "retry_exhausted"],
  [new PolarRateLimitError(429), "retry_exhausted"],
  [new PolarServerError(503, "unavailable"), "retry_exhausted"],
  [new PolarClientError(422, "invalid"), "permanent_error"],
] as const)("reports delivery failure: %s", async (error, reason) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockRejectedValue(error);
  let finishDrop!: () => void;
  const onDropped = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishDrop = resolve;
      }),
  );
  await using strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { maxAttempts: 1, onDropped },
  ).start();
  await strategy.track(events[0]);
  const flushed = vi.fn();
  const flushing = strategy.flush().then(flushed);
  try {
    await vi.waitFor(() => expect(onDropped).toHaveBeenCalledOnce());
    expect(flushed).not.toHaveBeenCalled();
  } finally {
    finishDrop();
  }
  await flushing;
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
    const strategy = await new BufferedMeteringStrategy(
      { events: { ingest } },
      {
        batchSize: 1,
        shutdownTimeoutMs: 10,
        onDropped,
      },
    ).start();
    for (const event of events) await strategy.track(event);
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
  const strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    {
      shutdownTimeoutMs: 10,
      onDropped,
    },
  ).start();
  await strategy.track(events[0]);
  await strategy.close();
  expect(ingest).toHaveBeenCalledOnce();
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([events[0]], "shutdown_timeout");
});

it("flushes before propagating the scope error", async () => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  await expect(async () => {
    await using strategy = await new BufferedMeteringStrategy({ events: { ingest } }).start();
    await strategy.track(events[0]);
    throw new Error("body failed");
  }).rejects.toThrow("body failed");
  expect(ingest).toHaveBeenCalledOnce();
});

it("keeps a failing onDelivered out of the delivery retries", async () => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  const error = new PolarNetworkError("callback failed");
  const onDelivered = vi.fn().mockRejectedValue(error);
  const onDropped = vi.fn();
  const strategy = await new BufferedMeteringStrategy(
    { events: { ingest } },
    { maxAttempts: 1, onDelivered, onDropped },
  ).start();
  await strategy.track(events[0]);
  await expect(strategy.flush()).rejects.toBe(error);
  await expect(strategy.close()).rejects.toBe(error);
  expect(ingest).toHaveBeenCalledOnce();
  expect(onDropped).not.toHaveBeenCalled();
});
