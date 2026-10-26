import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import {
  CHANNEL,
  COLD_UNTIL,
  EPOCH,
  PENDING_COUNTS,
  encodePending,
  encodeState,
  pendingEntries,
  pendingIds,
} from "./benchmark";
import { CONFIRM_SCRIPT } from "./scripts";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };

const identityOf = (pending: number) => `external:alice:tokens-${pending}`;
const stateKeyOf = (pending: number) => `outpost:v1:state:${identityOf(pending)}`;
const pendingKeyOf = (pending: number) => `outpost:v1:pending:${identityOf(pending)}:${COLD_UNTIL}`;

let redisServer: RedisServer;
let redis: Redis;
let confirmSha: string;

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  confirmSha = (await redis.script("LOAD", CONFIRM_SCRIPT)) as string;
});

afterAll(async () => {
  redis.disconnect();
  await redisServer.stop();
});

describe("CONFIRM", () => {
  for (const pending of PENDING_COUNTS) {
    const stateKey = stateKeyOf(pending);
    const pendingKey = pendingKeyOf(pending);
    const ids = pendingIds(pending);
    const fields = [...encodeState(1), ...encodePending(COLD_UNTIL, pending)];
    const entries = pendingEntries(ids);
    // Each call confirms every pending event. The transaction seeds the state and the pending
    // events first, at a cost the script's changes don't move.
    bench(
      `confirm ${pending} pending events`,
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
            identityOf(pending),
            CHANNEL,
            EPOCH,
            COLD_UNTIL,
            "",
            ...ids,
          )
          .exec();
        for (const [error] of results ?? []) if (error) throw error;
      },
      OPTIONS,
    );
  }
});
