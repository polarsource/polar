import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

import { PolarError } from "./base";

export const DEFAULT_TIMEOUT = 5000;
const REDIS_RECONNECT_DELAY = 100;
const MAX_REDIS_RECONNECT_DELAY = 2000;

const BACKOFF_SCRIPT = `
-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum. Failures
-- met during one wait count as one: they only move the retry later, never sooner.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[4]

local waiting_until = tonumber(redis.call('HGET', key, 'retry_at')) or 0
local failures = waiting_until > now and tonumber(redis.call('HGET', key, 'failures'))
    or redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = math.max(waiting_until, now + delay)
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
return retry_at
`;

const RELEASE_LOCK_SCRIPT = `
-- Deletes the lock, if it still holds this instance's token: once the lock expired, another
-- instance may hold it.
local lock = KEYS[1]
local token = ARGV[1]

if redis.call('GET', lock) == token then
    return redis.call('DEL', lock)
end
return 0
`;

const EXTEND_LOCK_SCRIPT = `
-- Keeps the lock for another ttl milliseconds, if it still holds this instance's token.
local lock = KEYS[1]
local token = ARGV[1]
local ttl = ARGV[2]

if redis.call('GET', lock) == token then
    return redis.call('PEXPIRE', lock, ttl)
end
return 0
`;

export const reconnectDelay = (attempt: number): number =>
  Math.min(MAX_REDIS_RECONNECT_DELAY, REDIS_RECONNECT_DELAY * 2 ** (attempt - 1)) *
  (0.5 + Math.random() / 2);

export const createRedis = (url: string): Redis => {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    autoResendUnfulfilledCommands: false,
    maxRetriesPerRequest: 0,
    connectTimeout: DEFAULT_TIMEOUT,
    commandTimeout: DEFAULT_TIMEOUT,
    retryStrategy: reconnectDelay,
  });
  redis.on("error", () => {});
  return redis;
};

export const connectRedis = async (redis: Redis): Promise<void> => {
  const deadline = Date.now() + DEFAULT_TIMEOUT;
  for (let attempt = 1; ; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        redis.connect(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new PolarError("Redis connection timed out")),
            DEFAULT_TIMEOUT,
          );
        }),
      ]);
      await redis.ping();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      redis.disconnect();
      await sleep(reconnectDelay(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
};

// A process that slept may wake on a socket Redis closed meanwhile: ioredis sees it on the next
// write, then reconnects. While Redis is down, each attempt errors and this returns at once.
export const reconnected = async (redis: Redis): Promise<boolean> => {
  if (redis.status === "end" || (redis.status === "ready" && redis.stream.writable)) return false;
  return once(redis, "ready", { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) }).then(
    () => true,
    () => false,
  );
};

// A lock holds its owner's token: only the owner extends or releases it. Past its TTL, it may be
// another instance's.
export const takeLock = async (redis: Redis, key: string, ttl: number): Promise<string | null> => {
  const token = randomUUID();
  return (await redis.set(key, token, "PX", ttl, "NX")) ? token : null;
};

export const releaseLock = async (redis: Redis, key: string, token: string): Promise<boolean> =>
  redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).then(
    () => true,
    () => false,
  );

export const extendLock = async (
  redis: Redis,
  key: string,
  token: string,
  ttl: number,
): Promise<boolean> => Boolean(await redis.eval(EXTEND_LOCK_SCRIPT, 1, key, token, ttl));

export const backOff = async (
  redis: Redis | undefined,
  key: string,
  { first, max, forget }: { first: number; max: number; forget?: number },
): Promise<number> => {
  const now = Date.now();
  const retryAt = await redis
    ?.eval(BACKOFF_SCRIPT, 1, key, now, first, max, ...(forget === undefined ? [] : [forget]))
    .catch(() => undefined);
  return Number(retryAt ?? now + first);
};
