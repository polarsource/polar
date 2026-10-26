import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import {
  BUCKET_COUNTS,
  CHANNEL,
  COLD_UNTIL,
  EPOCH,
  PENDING_COUNTS,
  encodePending,
  encodeState,
  pendingEntries,
  pendingIds,
} from "./benchmark";
import { BUCKET_SIZE } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT, CONFIRM_SCRIPT } from "./scripts";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };

const identityOf = (buckets: number, pending: number) =>
  `external:alice:tokens-${buckets}-${pending}`;

let redisServer: RedisServer;
let redis: Redis;
let confirmSha: string;
let applySnapshotSha: string;

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  confirmSha = (await redis.script("LOAD", CONFIRM_SCRIPT)) as string;
  applySnapshotSha = (await redis.script("LOAD", APPLY_SNAPSHOT_SCRIPT)) as string;
});

afterAll(async () => {
  redis.disconnect();
  await redisServer.stop();
});

// What a snapshot costs once Polar confirmed the newest bucket's pending events: CONFIRM then
// APPLY_SNAPSHOT in one transaction, as the client runs them.
describe("CONFIRM then APPLY_SNAPSHOT", () => {
  for (const buckets of BUCKET_COUNTS) {
    for (const pending of PENDING_COUNTS) {
      const identity = identityOf(buckets, pending);
      const stateKey = `outpost:v1:state:${identity}`;
      const newestBucketStart = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE;
      const pendingKey = `outpost:v1:pending:${identity}:${newestBucketStart}`;
      const ids = pendingIds(pending);
      const fields = [...encodeState(buckets), ...encodePending(newestBucketStart, pending)];
      const entries = pendingEntries(ids);
      // The snapshot moves cold_until past every local bucket, so each call seals them all. The
      // transaction seeds the state and the pending events first, at a cost the scripts' changes
      // don't move.
      const cutoff = COLD_UNTIL + buckets * BUCKET_SIZE;
      bench(
        `seal a ${buckets}-bucket state confirming ${pending} events`,
        async () => {
          const results = await redis
            .multi()
            .hset(stateKey, ...fields)
            .hset(pendingKey, ...entries)
            .evalsha(
              confirmSha,
              2,
              stateKey,
              pendingKey,
              identity,
              CHANNEL,
              EPOCH,
              newestBucketStart,
              "",
              ...ids,
            )
            .evalsha(
              applySnapshotSha,
              1,
              stateKey,
              identity,
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
  }
});
