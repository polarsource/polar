import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

import { PolarError } from "./base";

export const DEFAULT_TIMEOUT = {{ redis_constants.timeout }};
const REDIS_RECONNECT_DELAY = {{ redis_constants.reconnect_delay }};
const MAX_REDIS_RECONNECT_DELAY = {{ redis_constants.max_reconnect_delay }};

const BACKOFF_SCRIPT = `
{{ redis_scripts.common.backoff }}`;

const RELEASE_LOCK_SCRIPT = `
{{ redis_scripts.common.release_lock }}`;

const EXTEND_LOCK_SCRIPT = `
{{ redis_scripts.common.extend_lock }}`;

const reconnectDelay = (attempt: number): number =>
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
          timer = setTimeout(() => reject(new PolarError("Redis connection timed out")), DEFAULT_TIMEOUT);
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

export const releaseLock = async (redis: Redis, key: string, token: string): Promise<void> => {
  await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch(() => {});
};

export const extendLock = async (redis: Redis, key: string, token: string, ttl: number): Promise<boolean> =>
  Boolean(await redis.eval(EXTEND_LOCK_SCRIPT, 1, key, token, ttl));

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
