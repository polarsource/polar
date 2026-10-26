import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { BUCKET_COUNTS, CHANNEL, COLD_UNTIL, EPOCH, encodeState } from "./benchmark";
import { BUCKET_SIZE } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT, READ_STATE_SCRIPT, WRITE_BUCKET_SCRIPT } from "./scripts";
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
const writeArgs = (identity: string, bucketStart: number) => [
  stateKey(identity),
  `outpost:v1:pending:${identity}:${bucketStart}`,
  identity,
  CHANNEL,
  EPOCH,
  bucketStart,
  1,
  7,
  7,
  7,
  `event-${++sequence}`,
];

let redisServer: RedisServer;
let redis: Redis;
let writeBucketSha: string;
let readStateSha: string;
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
  readStateSha = (await redis.script("LOAD", READ_STATE_SCRIPT)) as string;
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
          2,
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
      for (const reducer of REDUCERS) {
        const identity = `external:alice:${reducer}`;
        pipeline.evalsha(writeBucketSha, 2, ...writeArgs(identity, COLD_UNTIL));
      }
      const results = await pipeline.exec();
      for (const [error] of results ?? []) if (error) throw error;
    },
    OPTIONS,
  );
});

describe("READ_STATE", () => {
  for (const buckets of BUCKET_COUNTS) {
    bench(
      `read a ${buckets}-bucket state`,
      async () => {
        await redis.evalsha(readStateSha, 1, keyOf(buckets), EPOCH);
      },
      OPTIONS,
    );
  }
});

describe("APPLY_SNAPSHOT", () => {
  for (const buckets of BUCKET_COUNTS) {
    // Same cold_until and version as the seeded state: the script rescans every field and
    // rewrites the cold summary, but seals no bucket, so the state keeps its size.
    bench(
      `apply a snapshot to a ${buckets}-bucket state`,
      async () => {
        await redis.evalsha(
          applySnapshotSha,
          1,
          keyOf(buckets),
          identityOf(buckets),
          CHANNEL,
          EPOCH,
          COLD_UNTIL,
          COLD_UNTIL + 1,
          "meter",
          1_000_000,
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
