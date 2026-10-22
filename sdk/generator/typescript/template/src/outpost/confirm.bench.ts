import { Redis } from "ioredis";
import { once } from "node:events";
import { afterAll, beforeAll, bench, describe } from "vitest";

import { CHANNEL, COLD_UNTIL, EPOCH, encodeState } from "./benchmark";
import { CONFIRM_SCRIPT } from "./scripts";
import { startRedisServer, type RedisServer } from "./testing";

const OPTIONS = { warmupTime: 500, time: 2_000 };
// Events pending in one bucket: a batch the buffer just delivered, and a backlog after a 429.
const PENDING_COUNTS = [1, 100, 1000];

const identityOf = (pending: number) => `external:alice:tokens-${pending}`;
const stateKeyOf = (pending: number) => `outpost:state:${identityOf(pending)}`;
const pendingKeyOf = (pending: number) => `outpost:pending:${identityOf(pending)}:${COLD_UNTIL}`;
const idsOf = (pending: number) => Array.from({ length: pending }, (_, i) => `event-${i}`);
// What WRITE_BUCKET stores per event: count, sum, min and max, as strings.
const entry = JSON.stringify(["1", "7", "7", "7"]);

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
    const ids = idsOf(pending);
    const fields = [
      ...encodeState(1),
      `pending:${COLD_UNTIL}:count`,
      String(pending),
      `pending:${COLD_UNTIL}:sum`,
      String(7 * pending),
      `pending:${COLD_UNTIL}:min`,
      "7",
      `pending:${COLD_UNTIL}:max`,
      "7",
    ];
    const entries = ids.flatMap((id) => [id, entry]);
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
            ...ids,
          )
          .exec();
        for (const [error] of results ?? []) if (error) throw error;
      },
      OPTIONS,
    );
  }
});
