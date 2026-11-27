import { afterEach, expect, it, vi } from "vitest";

import type { EventInput } from "../event";
import type { Ingest } from "./index";

import { IngestRejectedError, IngestRetryableError, MeteringDeliveryError } from "../errors";
import { MemoryEventQueue } from "./memory";

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
  const strategy = new MemoryEventQueue({ batchSize: 2, batchIntervalMs: 60_000 });
  try {
    await expect(strategy.enqueue(events[0])).rejects.toThrow("not running");
    await expect(strategy.flush()).rejects.toThrow("not running");
    await strategy.start({ ingest });
    await expect(strategy.start({ ingest })).rejects.toThrow("already started");
    await strategy.flush();
    expect(ingest).not.toHaveBeenCalled();
    for (const event of events) await strategy.enqueue(event);
    await strategy.flush();
    expect(ingest.mock.calls.map(([body]) => body)).toEqual([
      events.slice(0, 2),
      events.slice(2, 4),
      events.slice(4),
    ]);
    await strategy.enqueue(events[0]);
    await strategy.flush();
    expect(ingest).toHaveBeenCalledTimes(4);
    await strategy.close();
    await expect(strategy.flush()).rejects.toThrow("not running");
  } finally {
    await strategy.close().catch(() => {});
  }
});

it("starts the batch interval with the first event without resetting it", async () => {
  vi.useFakeTimers();
  const ingest = vi.fn().mockResolvedValue(undefined);
  const strategy = await new MemoryEventQueue({ batchIntervalMs: 100 }).start({ ingest });
  try {
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(50);
    await strategy.enqueue(events[0]);
    await vi.advanceTimersByTimeAsync(50);
    await strategy.enqueue(events[1]);
    expect(ingest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(ingest).toHaveBeenCalledExactlyOnceWith(events.slice(0, 2), expect.anything());
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await strategy.close().catch(() => {});
  }
});

it("keeps the newest flush boundary while a batch is in flight", async () => {
  let finishDelivery!: () => void;
  const ingest = vi.fn(
    (_body: EventInput[]) =>
      new Promise<void>((resolve) => {
        finishDelivery = resolve;
      }),
  );
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest });
  try {
    try {
      await strategy.enqueue(events[0]);
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
      const firstFlush = strategy.flush();
      await strategy.enqueue(events[1]);
      const secondDone = vi.fn();
      const secondFlush = strategy.flush().then(secondDone);
      const closed = vi.fn();
      const closing = strategy.close().then(closed);
      await expect(strategy.flush()).rejects.toThrow("not running");
      await firstFlush;
      finishDelivery();
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));
      expect(secondDone).not.toHaveBeenCalled();
      expect(closed).not.toHaveBeenCalled();
      finishDelivery();
      await Promise.all([secondFlush, closing]);
      expect(ingest.mock.calls.map(([body]) => body)).toEqual([[events[0]], [events[1]]]);
    } finally {
      ingest.mockResolvedValue(undefined);
      finishDelivery();
    }
  } finally {
    await strategy.close().catch(() => {});
  }
});

it.each([
  { batchSize: 100, batches: [[1, 2, 3]] },
  { batchSize: 2, batches: [[1, 2], [3]] },
])(
  "batches events queued behind released flushes (batch size $batchSize)",
  async ({ batchSize, batches }) => {
    const deliveries: (() => void)[] = [];
    const ingest = vi.fn(
      (_body: EventInput[]) =>
        new Promise<void>((resolve) => {
          deliveries.push(resolve);
        }),
    );
    const strategy = await new MemoryEventQueue({ batchSize, batchIntervalMs: 60_000 }).start({
      ingest,
    });
    try {
      try {
        await strategy.enqueue(events[0]);
        const first = strategy.flush();
        await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
        const flushed = [1, 2, 3].map(() => vi.fn());
        const flushes: Promise<void>[] = [];
        for (const [index, event] of events.slice(1, 4).entries()) {
          await strategy.enqueue(event);
          flushes.push(strategy.flush().then(flushed[index]));
        }
        await Promise.all([first, ...flushes.slice(0, -1)]);
        deliveries.shift()!();
        for (const [index, batch] of batches.entries()) {
          await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(index + 2));
          expect(ingest.mock.calls[index + 1][0]).toEqual(batch.map((i) => events[i]));
          expect(flushed[2]).not.toHaveBeenCalled();
          deliveries.shift()!();
        }
        await flushes[2];
        expect(ingest).toHaveBeenCalledTimes(batches.length + 1);
      } finally {
        ingest.mockResolvedValue(undefined);
        for (const finishDelivery of deliveries) finishDelivery();
      }
    } finally {
      await strategy.close().catch(() => {});
    }
  },
);

it.each(["shutdown timeout", "worker error"])(
  "rejects the waiting flush on %s",
  async (failure) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let failDelivery!: (error: Error) => void;
    const ingest = vi.fn(async (_body: unknown, options?: Parameters<Ingest>[1]) => {
      await new Promise<void>((_, reject) => {
        failDelivery = reject;
        options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
          once: true,
        });
      });
    });
    const onRejected = vi.fn();
    const strategy = await new MemoryEventQueue({ batchIntervalMs: 60_000 }).start({
      ingest,
      onRejected,
    });
    try {
      await strategy.enqueue(events[0]);
      const firstFlush = strategy.flush();
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
      await strategy.enqueue(events[1]);
      const flushes = Promise.allSettled([firstFlush, strategy.flush()]);
      const error = failure === "worker error" ? "broken transport" : "shutdown timed out";
      if (failure === "worker error") {
        failDelivery(new TypeError(error));
        await expect(strategy.close()).rejects.toThrow(error);
        await expect(strategy.flush()).rejects.toThrow("not running");
        await expect(strategy.enqueue(events[0])).rejects.toThrow("not running");
        expect(onRejected).not.toHaveBeenCalled();
      } else {
        await expect(strategy.close({ timeoutMs: 10 })).rejects.toBeInstanceOf(
          MeteringDeliveryError,
        );
        expect(onRejected).not.toHaveBeenCalled();
      }
      const [first, second] = await flushes;
      expect(first.status).toBe("fulfilled");
      expect(second).toMatchObject({
        status: "rejected",
        reason:
          failure === "worker error"
            ? { message: expect.stringContaining(error) }
            : expect.any(MeteringDeliveryError),
      });
    } finally {
      await strategy.close().catch(() => {});
    }
  },
);

it.each([0, 1, 5])("drains %i events in bounded batches on close", async (count) => {
  const ingest = vi.fn().mockResolvedValue(undefined);
  {
    const strategy = await new MemoryEventQueue({ batchSize: 2, batchIntervalMs: 60_000 }).start({
      ingest,
    });
    try {
      for (const event of events.slice(0, count)) await strategy.enqueue(event);
    } finally {
      await strategy.close().catch(() => {});
    }
  }
  const batches = ingest.mock.calls.map(([body]) => body as EventInput[]);
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
    const strategy = await new MemoryEventQueue(options).start({ ingest });
    try {
      await strategy.enqueue(events[0]);
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledOnce());
      expect(ingest.mock.calls[0][0]).toEqual([events[0]]);
    } finally {
      await strategy.close().catch(() => {});
    }
  },
);

it("honors Retry-After and preserves the batch through retries", async () => {
  const onRejected = vi.fn();
  const ingest = vi
    .fn()
    .mockRejectedValueOnce(new IngestRetryableError({ retryAfterMs: 1000 }))
    .mockResolvedValue(undefined);
  const strategy = await new MemoryEventQueue().start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await strategy.flush();
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ingest.mock.calls[0]).toEqual(ingest.mock.calls[1]);
    expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await strategy.close().catch(() => {});
  }
});

it("waits at least a second on Retry-After without spending attempts", async () => {
  const onRejected = vi.fn();
  const calls: number[] = [];
  const ingest = vi.fn(async () => {
    calls.push(performance.now());
    if (calls.length === 1) throw new IngestRetryableError({ retryAfterMs: 1000 });
  });
  const strategy = await new MemoryEventQueue({ maxAttempts: 1 }).start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await strategy.flush();
    expect(calls).toHaveLength(2);
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(900);
    expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await strategy.close().catch(() => {});
  }
});

it("drops the batch when Retry-After exceeds the wait budget", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const onRejected = vi.fn();
  const ingest = vi.fn().mockRejectedValue(new IngestRetryableError({ retryAfterMs: 301_000 }));
  const strategy = await new MemoryEventQueue().start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await expect(strategy.flush()).rejects.toBeInstanceOf(MeteringDeliveryError);
    expect(ingest).toHaveBeenCalledOnce();
    expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await strategy.close().catch(() => {});
  }
}, 500);

it.each([
  [new IngestRetryableError(), "retry_exhausted"],
  [new IngestRejectedError(), "permanent_error"],
] as const)("reports delivery failure: %s", async (error, reason) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockRejectedValue(error);
  let finishDrop!: () => void;
  const onRejected = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishDrop = resolve;
      }),
  );
  const strategy = await new MemoryEventQueue({ maxAttempts: 1 }).start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    const flushed = vi.fn();
    const flushing = strategy.flush().then(flushed, (failure) => failure);
    if (reason === "permanent_error") {
      try {
        await vi.waitFor(() => expect(onRejected).toHaveBeenCalledOnce());
        expect(flushed).not.toHaveBeenCalled();
      } finally {
        finishDrop();
      }
    }
    await expect(flushing).resolves.toMatchObject({
      events: [events[0]],
      failures: [{ reason, cause: error }],
    });
    expect(ingest).toHaveBeenCalledOnce();
    if (reason === "permanent_error")
      expect(onRejected).toHaveBeenCalledExactlyOnceWith([events[0]], reason);
    else expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await strategy.close().catch(() => {});
  }
});

it("resends the rest of a batch after ingest rejects one event", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi
    .fn()
    .mockRejectedValueOnce(new IngestRejectedError({ rejectedIndexes: new Set([1]) }))
    .mockResolvedValue(undefined);
  const onAck = vi.fn();
  const onRejected = vi.fn();
  const queue = await new MemoryEventQueue().start({ ingest, onAck, onRejected });
  const [first, rejected, last] = events;
  try {
    for (const event of [first, rejected, last]) await queue.enqueue(event);
    await expect(queue.flush()).rejects.toMatchObject({ events: [rejected] });
    expect(ingest.mock.calls.map(([batch]) => batch)).toEqual([
      [first, rejected, last],
      [first, last],
    ]);
    expect(onRejected).toHaveBeenCalledExactlyOnceWith([rejected], "permanent_error");
    expect(onAck).toHaveBeenCalledExactlyOnceWith([first, last]);
  } finally {
    await queue.close();
  }
});

it.each([false, true])(
  "reports only unfinished events at the shutdown deadline (first dropped: %s)",
  async (dropFirst) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onRejected = vi.fn();
    const ingest = vi.fn(async (batch: EventInput[], options?: Parameters<Ingest>[1]) => {
      if (batch[0] === events[0]) {
        if (dropFirst) throw new IngestRejectedError();
        return;
      }
      await new Promise<void>((_, reject) => {
        options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), {
          once: true,
        });
      });
    });
    const strategy = await new MemoryEventQueue({
      batchSize: 1,
    }).start({ ingest, onRejected });
    try {
      for (const event of events) await strategy.enqueue(event);
      await expect(strategy.close({ timeoutMs: 10 })).rejects.toBeInstanceOf(MeteringDeliveryError);
      expect(onRejected.mock.calls).toEqual(dropFirst ? [[[events[0]], "permanent_error"]] : []);
      expect(ingest).toHaveBeenCalledTimes(2);
    } finally {
      await strategy.close().catch(() => {});
    }
  },
);

it("cancels a retry wait at the shutdown deadline", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockRejectedValue(new IngestRetryableError());
  const onRejected = vi.fn();
  const strategy = await new MemoryEventQueue().start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await expect(strategy.close({ timeoutMs: 10 })).rejects.toBeInstanceOf(MeteringDeliveryError);
    expect(ingest).toHaveBeenCalledOnce();
    expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await strategy.close().catch(() => {});
  }
});

it.each([false, true])("keeps delivering after a hook fails (rejected: %s)", async (rejected) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const ingest = vi.fn().mockResolvedValue(undefined);
  const error = new IngestRejectedError();
  const hookError = new Error("private event details");
  const onAck = vi.fn();
  const onRejected = vi.fn().mockRejectedValueOnce(hookError);
  if (rejected) ingest.mockRejectedValueOnce(error);
  else onAck.mockRejectedValueOnce(hookError);
  const queue = await new MemoryEventQueue().start({ ingest, onAck, onRejected });
  try {
    await queue.enqueue(events[0]);
    if (rejected) {
      await expect(queue.flush()).rejects.toMatchObject({ cause: error });
      expect(onRejected).toHaveBeenCalledExactlyOnceWith(events.slice(0, 1), "permanent_error");
    } else {
      await queue.flush();
      expect(onRejected).not.toHaveBeenCalled();
    }
    await queue.enqueue(events[1]);
    await queue.flush();
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      rejected ? "Memory queue rejection hook failed" : "Memory queue acknowledgement hook failed",
      "Error",
    );
  } finally {
    await queue.close();
  }
});

it("reports background drops to the newest overlapping flush, then recovers", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const cause = new IngestRejectedError();
  const ingest = vi.fn().mockRejectedValueOnce(cause).mockResolvedValue(undefined);
  const onRejected = vi.fn();
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await vi.waitFor(() => expect(onRejected).toHaveBeenCalledOnce());
    const [older, newer] = await Promise.allSettled([strategy.flush(), strategy.flush()]);
    expect(older.status).toBe("fulfilled");
    expect(newer).toMatchObject({
      status: "rejected",
      reason: {
        events: [events[0]],
        cause,
        failures: [{ reason: "permanent_error", cause }],
      },
    });
    await strategy.enqueue(events[1]);
    await strategy.flush();
    expect(ingest).toHaveBeenCalledTimes(2);
  } finally {
    await strategy.close();
  }
});

it("does not include later failed events in an earlier flush boundary", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ingest = vi
    .fn()
    .mockImplementationOnce(() => gate)
    .mockRejectedValue(new IngestRejectedError());
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest });
  try {
    await strategy.enqueue(events[0]);
    const first = strategy.flush();
    await strategy.enqueue(events[1]);
    const second = strategy.flush().catch((error) => error);
    release();
    await first;
    expect(await second).toMatchObject({ events: [events[1]] });
  } finally {
    release();
    await strategy.close();
  }
});

it("releases an older flush when a newer one starts, and reports both boundaries to the newer", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cause = new IngestRejectedError();
  const ingest = vi.fn(async () => {
    await gate;
    throw cause;
  });
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest });
  try {
    await strategy.enqueue(events[0]);
    const older = strategy.flush().then(() => "released");
    await strategy.enqueue(events[1]);
    const newer = strategy.flush().catch((error) => error);
    const waiting = new Promise((resolve) => setTimeout(() => resolve("waiting"), 50));
    expect(await Promise.race([older, waiting])).toBe("released");
    expect(ingest).toHaveBeenCalledOnce();
    release();
    expect(await newer).toMatchObject({ events: [events[0], events[1]], cause });
  } finally {
    release();
    await strategy.close().catch(() => {});
  }
});

it("a newer flush with a shorter timeout does not release an older one", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ingest = () => gate;
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest });
  try {
    await strategy.enqueue(events[0]);
    const olderDone = vi.fn();
    const older = strategy.flush().then(olderDone);
    await expect(strategy.flush({ timeoutMs: 10 })).rejects.toBeInstanceOf(MeteringDeliveryError);
    expect(olderDone).not.toHaveBeenCalled();
    release();
    await older;
  } finally {
    release();
    await strategy.close();
  }
});

it("a flush timeout does not cancel delivery or acknowledge unseen drops", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let signal: AbortSignal | undefined;
  const cause = new IngestRejectedError();
  const ingest = vi.fn(async (_body: unknown, options?: Parameters<Ingest>[1]) => {
    signal = options?.signal;
    await gate;
    throw cause;
  });
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest });
  try {
    await strategy.enqueue(events[0]);
    const timedOut = strategy.flush({ timeoutMs: 10 }).catch((error) => error);
    expect(await timedOut).toMatchObject({
      events: [events[0]],
      failures: [{ reason: "flush_timeout" }],
    });
    expect(signal?.aborted).toBe(false);
    release();
    await expect(strategy.flush()).rejects.toMatchObject({ events: [events[0]], cause });
    await strategy.flush();
  } finally {
    release();
    await strategy.close();
  }
});

it("an abandoned flush leaves its eventual failure observable", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const onRejected = vi.fn();
  const cause = new IngestRejectedError();
  const ingest = async () => {
    await gate;
    throw cause;
  };
  const strategy = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest, onRejected });
  try {
    await strategy.enqueue(events[0]);
    await expect(strategy.flush({ timeoutMs: 10 })).rejects.toBeInstanceOf(MeteringDeliveryError);
    release();
    await vi.waitFor(() => expect(onRejected).toHaveBeenCalledOnce());
    await expect(strategy.flush()).rejects.toMatchObject({ events: [events[0]], cause });
    await strategy.flush();
  } finally {
    release();
    await strategy.close();
  }
});

it("reports a worker error without calling onRejected", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const cause = new TypeError("broken transport");
  const onRejected = vi.fn();
  const ingest = vi.fn().mockRejectedValue(cause);
  const queue = await new MemoryEventQueue({ batchSize: 1 }).start({ ingest, onRejected });
  try {
    await queue.enqueue(events[0]);
    await expect(queue.flush()).rejects.toMatchObject({
      events: [events[0]],
      failures: [{ reason: "worker_error", cause }],
    });
    expect(onRejected).not.toHaveBeenCalled();
  } finally {
    await queue.close().catch(() => {});
  }
});
