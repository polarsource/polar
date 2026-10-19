import { Redis } from "ioredis";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, bench, describe, vi } from "vitest";

import { BUCKET_SIZE } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT, READ_STATE_SCRIPT, WRITE_BUCKET_SCRIPT } from "./scripts";

const COLD_UNTIL = Date.UTC(2026, 9, 1, 12, 0, 0) * 1_000;
// 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
const BUCKET_COUNTS = [1, 12, 288];
const CHANNEL = "outpost:bench:updates";
const EPOCH = "0123456789abcdef0123456789abcdef";
const OPTIONS = { warmupTime: 500, time: 2_000 };

const identityOf = (buckets: number) => `external:alice:tokens-${buckets}`;
const keyOf = (buckets: number) => `outpost:state:${identityOf(buckets)}`;

let directory: string;
let redisProcess: ChildProcess;
let redis: Redis;
let readStateSha: string;
let applySnapshotSha: string;

const seedState = async (buckets: number): Promise<void> => {
  const fields: Record<string, string> = {
    epoch: EPOCH,
    revision: "4242",
    cold_until: String(COLD_UNTIL),
    snapshot_version: String(COLD_UNTIL + 1),
    "cold:count": "1000",
    "cold:sum": "123456",
    "cold:min": "1",
    "cold:max": "999",
    "credited:meter": "1000000",
    "credited_version:meter": String(COLD_UNTIL + 1),
  };
  for (let index = 0; index < buckets; index++) {
    const prefix = `bucket:${COLD_UNTIL + index * BUCKET_SIZE}:`;
    fields[`${prefix}count`] = "10";
    fields[`${prefix}sum`] = String(100 + index);
    fields[`${prefix}min`] = "1";
    fields[`${prefix}max`] = String(50 + index);
  }
  await redis.hset(keyOf(buckets), fields);
};

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "polar-outpost-bench-"));
  const socket = join(directory, "redis.sock");
  redisProcess = spawn(
    "redis-server",
    ["--port", "0", "--unixsocket", socket, "--save", "", "--appendonly", "no"],
    { stdio: "ignore" },
  );
  let startupError: Error | undefined;
  redisProcess.on("error", (error) => {
    startupError = error;
  });
  await vi.waitFor(async () => {
    if (startupError) throw startupError;
    await access(socket);
  });
  redis = new Redis(socket);
  await once(redis, "ready");
  // The client loads the read and snapshot scripts once and calls them by hash.
  readStateSha = (await redis.script("LOAD", READ_STATE_SCRIPT)) as string;
  applySnapshotSha = (await redis.script("LOAD", APPLY_SNAPSHOT_SCRIPT)) as string;
  for (const buckets of BUCKET_COUNTS) await seedState(buckets);
});

afterAll(async () => {
  redis.disconnect();
  redisProcess.kill();
  await rm(directory, { recursive: true, force: true });
});

describe("WRITE_BUCKET", () => {
  for (const buckets of BUCKET_COUNTS) {
    const newestBucketStart = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE;
    bench(`write one event to a ${buckets}-bucket state`, async () => {
      await redis.eval(
        WRITE_BUCKET_SCRIPT,
        1,
        keyOf(buckets),
        identityOf(buckets),
        CHANNEL,
        EPOCH,
        newestBucketStart,
        1,
        7,
        7,
        7,
      );
    }, OPTIONS);
  }
});

describe("READ_STATE", () => {
  for (const buckets of BUCKET_COUNTS) {
    bench(`read a ${buckets}-bucket state`, async () => {
      await redis.evalsha(readStateSha, 1, keyOf(buckets), EPOCH);
    }, OPTIONS);
  }
});

describe("APPLY_SNAPSHOT", () => {
  for (const buckets of BUCKET_COUNTS) {
    // Same cold_until and version as the seeded state: the script rescans every field and
    // rewrites the cold summary, but seals no bucket, so the state keeps its size.
    bench(`apply a snapshot to a ${buckets}-bucket state`, async () => {
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
    }, OPTIONS);
  }
});
