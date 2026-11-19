import { afterAll, beforeAll, bench } from "vitest";

import type { EventInput } from "./event";

import { BufferedMeteringStrategy } from "./buffered";

// A fixed count: a flush that waits on Polar takes tens of milliseconds, one that does not takes
// microseconds, and a timed run of the fast one would queue more events than the worker delivers.
const OPTIONS = { iterations: 100, warmupIterations: 10, time: 0, warmupTime: 0 };
const POLAR_LATENCY_MS = 20;
const EVENT: EventInput = { name: "tick", external_customer_id: "alice" };

let strategy: BufferedMeteringStrategy;
let next: Promise<void> | undefined;

beforeAll(async () => {
  strategy = await new BufferedMeteringStrategy({
    events: {
      ingest: () => new Promise((resolve) => setTimeout(resolve, POLAR_LATENCY_MS)),
    },
  }).start();
});

afterAll(async () => {
  await next;
  await strategy.close();
});

// Each request flushes after its response, as in Next.js after(), and the next request flushes
// before the first one's batch reaches Polar: the time a serverless invocation stays open.
bench(
  `flush a request while the next one flushes, Polar answering in ${POLAR_LATENCY_MS} ms`,
  async () => {
    await strategy.track(EVENT);
    const flushed = strategy.flush();
    await strategy.track(EVENT);
    next = strategy.flush();
    await flushed;
  },
  OPTIONS,
);
