import { afterAll, bench, describe } from "vitest";

import { ClientBase } from "../base";
import { BUCKET_COUNTS, encodeState, EPOCH } from "./benchmark";
import { decodeState, Outpost, type State } from "./client";

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
    const { revision } = current;
    // Another instance wrote one event: the next revision, with the newest bucket.
    const bucket = [
      "epoch",
      EPOCH,
      "revision",
      String(revision + 1n),
      ...encodeState(buckets).slice(-8),
    ];
    const data = JSON.stringify({ customer: identity, bucket });
    bench(`receive a ${buckets}-bucket state update`, async () => {
      current.revision = revision;
      local.state = current;
      await receiver.receiveRedis(data);
    });
  }
});
