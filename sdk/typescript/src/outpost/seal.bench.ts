import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { BUCKET_COUNTS, CHANNEL, COLD_UNTIL, EPOCH, encodeState } from "./benchmark";
import { BUCKET_SIZE } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT } from "./scripts";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };

const identityOf = (buckets: number) => `external:alice:tokens-${buckets}`;
const keyOf = (buckets: number) => `outpost:v1:state:${identityOf(buckets)}`;

let redisServer: RedisServer;
let redis: Redis;
let applySnapshotSha: string;

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  applySnapshotSha = (await redis.script("LOAD", APPLY_SNAPSHOT_SCRIPT)) as string;
});

afterAll(async () => {
  redis.disconnect();
  await redisServer.stop();
});

describe("APPLY_SNAPSHOT", () => {
  for (const buckets of BUCKET_COUNTS) {
    const key = keyOf(buckets);
    const fields = encodeState(buckets);
    // The snapshot moves cold_until past every local bucket, so each call seals them all. The
    // transaction seeds the state first, at a cost the script's changes don't move.
    const cutoff = COLD_UNTIL + buckets * BUCKET_SIZE;
    bench(
      `seal a ${buckets}-bucket state`,
      async () => {
        const results = await redis
          .multi()
          .hset(key, ...fields)
          .evalsha(
            applySnapshotSha,
            1,
            key,
            identityOf(buckets),
            CHANNEL,
            EPOCH,
            cutoff,
            cutoff + 1,
            "meter",
            1_000_000,
            1000,
            123456,
            1,
            999,
          )
          .exec();
        for (const [error] of results ?? []) if (error) throw error;
      },
      OPTIONS,
    );
  }
});
