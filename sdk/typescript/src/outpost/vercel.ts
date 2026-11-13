/**
 * Outpost on Vercel: each customer's requests land on one instance, so its state stays warm there
 * and the merchant's Redis sees one set of connections per shard, not one per instance.
 */

import type { Redis } from "ioredis";

const AFFINITY_HEADER = "x-vercel-affinity-id";
const TRUSTED_TOKEN_HEADER = "x-vercel-trusted-oidc-idp-token";
const OIDC_HEADER = "x-vercel-oidc-token";
const WARMUP_HEADER = "x-polar-affinity-warmup";
// The shard count until Redis first answers.
const INITIAL_SHARDS = 64;
// Requests a second for one shard: about half of what one takes before Vercel answers 503.
const TARGET_PER_SHARD = 50;
// About four Redis connections per shard: past this, the merchant's Redis runs out first.
const MAX_SHARDS = 512;
// A shard moves to a fresh instance this long before Vercel would retire its own.
const HANDOFF_MS = 60_000;
// The shard's next instance starts this long before the shard moves to it.
const WARM_MS = 30_000;
// Temporary, while Vercel answers 503 to a fresh pinned instance that takes a whole shard at once:
// each customer moves at its own moment within this window around its shard's move. The last
// leave 15 s before Vercel retires the instance, which started with its warm-up.
const SPREAD_MS = 30_000;
// Each middleware process adds its requests to Redis this often; the count follows the last window.
const FLUSH_MS = 1_000;
const WINDOW_MS = 10_000;
// A new count applies this long after Redis decides it: the new shards are warm before the first
// customer moves, at the start of the spread.
const RESIZE_MS = WARM_MS + SPREAD_MS / 2;
// The count goes down only after this long under half the target.
const SHRINK_AFTER_MS = 5 * 60_000;
const PLAN_KEY = "outpost:v1:vercel-affinity";
const COUNT_KEY = "outpost:v1:vercel-affinity:requests";

const MASK = (1n << 64n) - 1n;

const fnv1a64 = (text: string): bigint => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text))
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & MASK;
  return hash;
};

/**
 * The shard a key lands on (Lamping and Veach's jump consistent hash). Going from N to N + 1
 * shards moves about 1/(N + 1) of the keys, all to the new shard: the rest keep warm instances.
 */
export const jumpHash = (key: string, buckets: number): number => {
  let seed = fnv1a64(key);
  let shard = -1;
  let next = 0;
  while (next < buckets) {
    shard = next;
    seed = (seed * 2862933555777941757n + 1n) & MASK;
    next = Math.floor((shard + 1) * (2 ** 31 / (Number(seed >> 33n) + 1)));
  }
  return shard;
};

export interface VercelAffinityOptions {
  /** The customer the request is for, by Polar's id or by yours; without one the request is not pinned. */
  customerId?: string | null;
  externalCustomerId?: string | null;
  /**
   * Outpost's Redis: the middleware counts its requests there, and the shard count follows the
   * load. Without it, the customers spread over 64 shards.
   */
  redisUrl?: string;
  /**
   * The pinned functions' `maxDuration`, in seconds. Vercel retires a pinned instance that old and
   * starts its successor only once it stopped; with this set, each shard moves to a fresh instance
   * a minute before, one shard at a time.
   */
  maxDurationSeconds?: number;
  /**
   * Warms each shard's next instance, and each new shard, before customers move to it. `url` is the
   * pinned route, and `waitUntil` the middleware's own (`event.waitUntil` in Next.js), which also
   * carries the request count to Redis. The route answers the warm-up first:
   * `if (isVercelAffinityWarmup(request))`.
   */
  warm?: { url: string | URL; waitUntil: (promise: Promise<unknown>) => void };
  now?: number;
}

// The id this process last warmed for each shard: one warm-up per shard and move.
const warmed = new Map<number, string>();

/** True for the request that starts a shard's next instance: answer it once Outpost is up. */
export const isVercelAffinityWarmup = (request: { headers: Headers }): boolean =>
  request.headers.get(WARMUP_HEADER) === "1";

const PERIOD_OFFSET = (Math.sqrt(5) - 1) / 2;

// Each shard moves at its own point of the period, the same whatever the count: a count that
// changes moves no shard that stays.
const affinityId = (shard: number, maxDurationSeconds: number | undefined, now: number) => {
  if (!maxDurationSeconds) return `shard-${shard}`;
  const period = Math.max(maxDurationSeconds * 500, maxDurationSeconds * 1000 - HANDOFF_MS);
  return `shard-${shard}-${Math.floor(now / period + ((shard * PERIOD_OFFSET) % 1))}`;
};

// Where in the spread a customer moves, the same at every move, from a key of its own: the
// customer's hash also picks its shard.
const skewOf = (customer: string) =>
  (Number(fnv1a64(`${customer}:handoff`) >> 11n) / 2 ** 53 - 0.5) * SPREAD_MS;

// The shard count, and the one that replaces it from `from` on (0 while none does).
interface Plan {
  shards: number;
  next: number;
  from: number;
}

// The shared plan, from the last window's requests. A new count waits RESIZE_MS, then settles once
// every customer has moved; it grows past the target at once, and shrinks after SHRINK_AFTER_MS
// under half of it, to half of it.
const RESIZE_SCRIPT = `
local now, count, window_s = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local target, initial, max = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
local resize_ms, settle_ms, shrink_after_ms = tonumber(ARGV[7]), tonumber(ARGV[8]), tonumber(ARGV[9])
if count > 0 then
  redis.call('INCRBY', KEYS[2], count)
  redis.call('PEXPIRE', KEYS[2], window_s * 6000)
end
local plan = redis.call('HMGET', KEYS[1], 'shards', 'next', 'from', 'low')
local function set(value)
  local number = tonumber(value)
  if number ~= 0 then return number end
end
local shards = set(plan[1]) or initial
local next, from, low = set(plan[2]), set(plan[3]), set(plan[4])
if next and now >= from + settle_ms then
  shards, next, from = next, nil, nil
end
local last = redis.call('GET', KEYS[3])
if last and not next then
  local rate = tonumber(last) / window_s
  if rate > shards * target and shards < max then
    next, from, low = math.min(max, math.ceil(rate / target)), now + resize_ms, nil
  elseif rate < shards * target / 2 then
    low = low or now
    if now - low >= shrink_after_ms then
      next, from, low = math.max(1, math.ceil(2 * rate / target)), now + resize_ms, nil
    end
  else
    low = nil
  end
end
redis.call('HSET', KEYS[1], 'shards', shards, 'next', next or 0, 'from', from or 0, 'low', low or 0)
return { shards, next or 0, from or 0 }
`;

let plan: Plan = { shards: INITIAL_SHARDS, next: 0, from: 0 };
let counted = 0;
let flushedAt = -Infinity;
const clients = new Map<string, Promise<Redis>>();

const redisFor = (url: string) => {
  let client = clients.get(url);
  if (!client) {
    // A failed flush keeps the last plan: the requests go on, pinned as before.
    client = import("ioredis").then(({ Redis }) => new Redis(url).on("error", () => {}));
    clients.set(url, client);
  }
  return client;
};

// Adds this process's requests to the window and reads the plan back.
const resize = async (url: string, now: number, count: number) => {
  const window = Math.floor(now / WINDOW_MS);
  const [shards, next, from] = (await (
    await redisFor(url)
  ).eval(
    RESIZE_SCRIPT,
    3,
    PLAN_KEY,
    `${COUNT_KEY}:${window}`,
    `${COUNT_KEY}:${window - 1}`,
    now,
    count,
    WINDOW_MS / 1000,
    TARGET_PER_SHARD,
    INITIAL_SHARDS,
    MAX_SHARDS,
    RESIZE_MS,
    SPREAD_MS / 2,
    SHRINK_AFTER_MS,
  )) as [number, number, number];
  plan = { shards, next, from };
};

// The count a customer follows: the next one once its moment in the spread has come.
const shardsFor = (customer: string, now: number) =>
  plan.next && now - skewOf(customer) >= plan.from ? plan.next : plan.shards;

// Vercel passes the token on the request; `@vercel/oidc` finds it elsewhere, where it is installed.
const oidcToken = async (headers: Headers): Promise<string | null> => {
  const token = headers.get(OIDC_HEADER);
  if (token) return token;
  try {
    const { getVercelOidcToken } = await import("@vercel/oidc");
    return await getVercelOidcToken();
  } catch {
    return null;
  }
};

/**
 * The request's headers, with the customer pinned to its shard and the project vouching for it, for
 * a middleware to pass on. A request without a customer, or outside Vercel, goes on unpinned.
 */
export const vercelAffinityHeaders = async (
  init: HeadersInit,
  options: VercelAffinityOptions,
): Promise<Headers> => {
  const headers = new Headers(init);
  // A warm-up already names the shard's next instance: re-pinning it would send it to the current one.
  if (isVercelAffinityWarmup({ headers })) return headers;
  const customer = options.externalCustomerId ?? options.customerId;
  if (!customer) return headers;
  const token = await oidcToken(headers);
  if (!token) return headers;
  const now = options.now ?? Date.now();
  if (options.redisUrl) {
    counted += 1;
    if (now - flushedAt >= FLUSH_MS) {
      flushedAt = now;
      const flush = resize(options.redisUrl, now, counted).catch(() => {});
      counted = 0;
      options.warm?.waitUntil(flush);
    }
  }
  const { maxDurationSeconds } = options;
  const shard = jumpHash(customer, shardsFor(customer, now));
  const current = affinityId(shard, maxDurationSeconds, now);
  headers.set(AFFINITY_HEADER, affinityId(shard, maxDurationSeconds, now - skewOf(customer)));
  headers.set(TRUSTED_TOKEN_HEADER, token);
  const { warm } = options;
  if (!warm) return headers;
  // The request's own headers, so the warm-up passes the merchant's middleware as it did.
  const warmUp = (target: number, id: string) => {
    if (warmed.get(target) === id) return;
    warmed.set(target, id);
    const warmup = new Headers(headers);
    for (const hop of ["content-length", "transfer-encoding", "connection", "host"])
      warmup.delete(hop);
    warmup.set(AFFINITY_HEADER, id);
    warmup.set(WARMUP_HEADER, "1");
    warm.waitUntil(
      fetch(warm.url, { method: "POST", headers: warmup }).then(
        (response) => response.body?.cancel(),
        () => {},
      ),
    );
  };
  const next = affinityId(shard, maxDurationSeconds, now + WARM_MS);
  if (next !== current) warmUp(shard, next);
  if (now < plan.from)
    for (let added = plan.shards; added < plan.next; added += 1)
      warmUp(added, affinityId(added, maxDurationSeconds, plan.from));
  return headers;
};

export interface VercelConfig {
  functions?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

/** Turns strict affinity on for the functions that read Outpost: Vercel reads it at build. */
export const withOutpostAffinity = <T extends VercelConfig>(config: T, functions: string[]): T => ({
  ...config,
  functions: {
    ...config.functions,
    ...Object.fromEntries(
      functions.map((path) => [
        path,
        { ...config.functions?.[path], affinity: { mode: "strict" } },
      ]),
    ),
  },
});
