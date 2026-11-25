import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
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

export const CONFIRM_SCRIPT = `
-- Settles groups of events, one per (state, bucket), and acknowledges the outbox entries that
-- carried them. KEYS[1] is the outbox, KEYS[2] the lock of the flusher that delivered them, then
-- each group's state and pending hash in turn. ARGV[1] is the hot-only flag, ARGV[2] and ARGV[3]
-- the lock's token and TTL, ARGV[4] the number of entries, then the entries; then each group
-- gives its bucket start, its number of ids and the ids.
local BATCH = 1000
-- An entry is the event's value, or nothing when it only counts.
local function value_of(entry)
    return entry ~= '' and tonumber(entry) or nil
end
local function settle(state, pending_key, start, ids)
    local bucket = 'bucket:' .. start .. ':'
    local pending = 'pending:' .. start .. ':'
    -- Polar received the events but no snapshot counts them yet: a cold bucket keeps them
    -- pending for the snapshot that will, a hot one counts them whole either way.
    if ARGV[1] == '1' then
        local cutoff = redis.call('HGET', state, 'cold_until')
        if cutoff and tonumber(start) < tonumber(cutoff) then
            return 0
        end
    end
    local gone, seen = {}, {}
    local removed, sum = 0, 0
    local current = redis.call('HMGET', state, pending .. 'min', pending .. 'max')
    local min, max = tonumber(current[1]), tonumber(current[2])
    local extremum = false
    for offset = 1, #ids, BATCH do
        local last = math.min(offset + BATCH - 1, #ids)
        local entries = redis.call('HMGET', pending_key, unpack(ids, offset, last))
        for i, entry in ipairs(entries) do
            local id = ids[offset + i - 1]
            if entry and not seen[id] then
                seen[id] = true
                table.insert(gone, id)
                removed = removed + 1
                local value = value_of(entry)
                if value then
                    sum = sum + value
                    if value == min or value == max then extremum = true end
                end
            end
        end
    end
    if removed == 0 then
        return 0
    end
    for offset = 1, #gone, BATCH do
        redis.call('HDEL', pending_key, unpack(gone, offset, math.min(offset + BATCH - 1, #gone)))
    end
    local count = tonumber(redis.call('HINCRBY', state, pending .. 'count', -removed))
    redis.call('HINCRBYFLOAT', state, pending .. 'sum', -sum)
    if count <= 0 then
        redis.call('HDEL', state, pending .. 'count', pending .. 'sum', pending .. 'min', pending .. 'max')
        local cutoff = redis.call('HGET', state, 'cold_until')
        -- Polar counts the whole bucket once it is cold: the local copy has nothing left to add.
        if cutoff and tonumber(start) < tonumber(cutoff) then
            redis.call('HDEL', state, bucket .. 'count', bucket .. 'sum', bucket .. 'min', bucket .. 'max')
        end
    elseif extremum then
        -- Extrema cannot be decremented: read them off the events still pending.
        min, max = nil, nil
        for _, entry in ipairs(redis.call('HVALS', pending_key)) do
            local value = value_of(entry)
            if value then
                if not min or value < min then min = value end
                if not max or value > max then max = value end
            end
        end
        for func, value in pairs({min = min, max = max}) do
            redis.call('HSET', state, pending .. func, tostring(value))
        end
        if not min then redis.call('HDEL', state, pending .. 'min') end
        if not max then redis.call('HDEL', state, pending .. 'max') end
    end
    redis.call('EXPIRE', state, 86400)
    return removed
end
local entries = tonumber(ARGV[4])
if entries > 0 then
    local ids = {}
    for i = 5, 4 + entries do table.insert(ids, ARGV[i]) end
    for offset = 1, #ids, BATCH do
        local batch = {unpack(ids, offset, math.min(offset + BATCH - 1, #ids))}
        redis.call('XACK', KEYS[1], 'polar', unpack(batch))
        redis.call('XDEL', KEYS[1], unpack(batch))
    end
    -- The flusher holds its slot through the next batch.
    if redis.call('GET', KEYS[2]) == ARGV[2] then
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
    end
end
local removed, cursor = 0, 5 + entries
for group = 1, (#KEYS - 2) / 2 do
    local start, count = ARGV[cursor], tonumber(ARGV[cursor + 1])
    local ids = {}
    for i = cursor + 2, cursor + 1 + count do table.insert(ids, ARGV[i]) end
    removed = removed + settle(KEYS[2 * group + 1], KEYS[2 * group + 2], start, ids)
    cursor = cursor + 2 + count
end
return removed
`;

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

// A lock holds its owner's token: only the owner extends or releases it. Past its TTL, it may be
// another instance's.
export const takeLock = async (redis: Redis, key: string, ttl: number): Promise<string | null> => {
  const token = randomUUID();
  return (await redis.set(key, token, "PX", ttl, "NX")) ? token : null;
};

export const releaseLock = async (redis: Redis, key: string, token: string): Promise<void> => {
  await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch(() => {});
};

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
