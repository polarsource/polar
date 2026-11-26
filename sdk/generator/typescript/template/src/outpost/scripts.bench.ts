import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { BUCKET_COUNTS, COLD_UNTIL, encodeState } from "./benchmark";
import { BUCKET_SIZE } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT, WRITE_BUCKET_SCRIPT } from "./scripts";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };

// One event usually matches several reducers; ingest sends their WRITE_BUCKET calls in one pipeline.
const REDUCERS = ["tokens", "calls", "cost"];

const stateKey = (identity: string) => `outpost:v1:state:${identity}`;
const identityOf = (buckets: number) => `external:alice:tokens-${buckets}`;
const keyOf = (buckets: number) => stateKey(identityOf(buckets));
// An event of 7 units in the given bucket: what WRITE_BUCKET takes after the key count. Each
// call brings a new external_id, as events do; the same one would be a duplicate and write nothing.
let sequence = 0;
// What track queues for Polar with an event's first write.
const queuedEvent = JSON.stringify({
  name: "api_call",
  external_customer_id: "alice",
  external_id: "event",
  timestamp: "2026-10-12T12:00:00.000Z",
  metadata: { tokens: 7 },
});
const writeArgs = (identity: string, bucketStart: number, queued = true) => [
  stateKey(identity),
  `outpost:v1:pending:${identity}:${bucketStart}`,
  `outpost:v1:rejected:${identity}:${bucketStart}`,
  "outpost:v1:outbox",
  "outpost:v1:outbox:flusher:0",
  bucketStart,
  7,
  `event-${++sequence}`,
  queued ? queuedEvent : "",
];

let redisServer: RedisServer;
let redis: Redis;
let writeBucketSha: string;
let applySnapshotSha: string;

const seedState = async (identity: string, buckets: number): Promise<void> => {
  await redis.hset(stateKey(identity), ...encodeState(buckets));
};

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  // The client loads each script once and calls it by hash.
  writeBucketSha = (await redis.script("LOAD", WRITE_BUCKET_SCRIPT)) as string;
  applySnapshotSha = (await redis.script("LOAD", APPLY_SNAPSHOT_SCRIPT)) as string;
  for (const buckets of BUCKET_COUNTS) await seedState(identityOf(buckets), buckets);
  for (const reducer of REDUCERS) await seedState(`external:alice:${reducer}`, 1);
});

afterAll(async () => {
  redis.disconnect();
  await redisServer.stop();
});

describe("WRITE_BUCKET", () => {
  for (const buckets of BUCKET_COUNTS) {
    const newestBucketStart = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE;
    bench(
      `write one event to a ${buckets}-bucket state`,
      async () => {
        await redis.evalsha(
          writeBucketSha,
          5,
          ...writeArgs(identityOf(buckets), newestBucketStart),
        );
      },
      OPTIONS,
    );
  }
  bench(
    "write one event to three reducers",
    async () => {
      const pipeline = redis.pipeline();
      for (const [index, reducer] of REDUCERS.entries()) {
        const identity = `external:alice:${reducer}`;
        pipeline.evalsha(writeBucketSha, 5, ...writeArgs(identity, COLD_UNTIL, index === 0));
      }
      const results = await pipeline.exec();
      for (const [error] of results ?? []) if (error) throw error;
    },
    OPTIONS,
  );
});

describe("APPLY_SNAPSHOT", () => {
  for (const buckets of BUCKET_COUNTS) {
    // The seeded snapshot again, as every instance gets each of Polar's: the script scans
    // every field, finds nothing to change and writes only the version.
    bench(
      `apply a snapshot to a ${buckets}-bucket state`,
      async () => {
        await redis.evalsha(
          applySnapshotSha,
          1,
          keyOf(buckets),
          COLD_UNTIL,
          COLD_UNTIL + 1,
          1000,
          123456,
          1,
          999,
        );
      },
      OPTIONS,
    );
  }
});
