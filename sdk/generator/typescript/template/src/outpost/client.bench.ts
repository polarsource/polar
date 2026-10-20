import { afterAll, bench, describe } from "vitest";

import { ClientBase } from "../base";
import { BUCKET_COUNTS, encodeState } from "./benchmark";
import { consumedUnits, decodeState, Outpost, type State } from "./client";

describe("decodeState", () => {
  for (const buckets of BUCKET_COUNTS) {
    const encoded = encodeState(buckets);
    bench(`decode a ${buckets}-bucket state`, () => {
      decodeState(encoded);
    });
  }
});

describe("consumedUnits", () => {
  for (const buckets of BUCKET_COUNTS) {
    const state = decodeState(encodeState(buckets));
    bench(`sum over a ${buckets}-bucket state`, () => {
      consumedUnits(state, "sum");
    });
  }
});

interface Receiver {
  cache: Map<
    string,
    { state?: State; pending: Promise<unknown>; missing: boolean; changed: { resolve(): void } }
  >;
  receiveRedis(data: string): Promise<void>;
  syncReceived: number;
  syncApplied: number;
}

const receiver = new Outpost("redis://127.0.0.1:1", {
  client: new ClientBase({
    baseUrl: "http://127.0.0.1:1",
    accessToken: "bench-token",
    version: "2026-10",
  }),
  telemetry: false,
}) as unknown as Receiver;

// Vitest runs no hook nested in a describe during benchmarks.
afterAll(() => {
  if (receiver.syncApplied !== receiver.syncReceived)
    throw new Error("A state update was not applied");
});

describe("receiveRedis", () => {
  for (const buckets of BUCKET_COUNTS) {
    const identity = `external:alice-${buckets}:tokens`;
    const current = decodeState(encodeState(buckets));
    const local = {
      state: current,
      pending: Promise.resolve(),
      missing: false,
      changed: { resolve() {} },
    };
    receiver.cache.set(identity, local);
    // Another instance wrote one event: the next revision of the same state.
    const newer = encodeState(buckets);
    newer[newer.indexOf("revision") + 1] = String(current.revision + 1n);
    const data = JSON.stringify({ customer: identity, state: newer });
    bench(`receive a ${buckets}-bucket state update`, async () => {
      local.state = current;
      await receiver.receiveRedis(data);
    });
  }
});
