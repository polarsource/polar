/**
 * Outpost on Vercel: each customer's requests land on one instance, so its state stays warm there
 * and the merchant's Redis sees one set of connections per shard, not one per instance.
 */

const AFFINITY_HEADER = "x-vercel-affinity-id";
const TRUSTED_TOKEN_HEADER = "x-vercel-trusted-oidc-idp-token";
const OIDC_HEADER = "x-vercel-oidc-token";
const WARMUP_HEADER = "x-polar-affinity-warmup";
export const DEFAULT_SHARDS = 64;
// A shard moves to a fresh instance this long before Vercel would retire its own.
const HANDOFF_MS = 60_000;
// The shard's next instance starts this long before the shard moves to it.
const WARM_MS = 30_000;

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
  /** How many instances the customers spread over. */
  shards?: number;
  /**
   * The pinned functions' `maxDuration`, in seconds. Vercel retires a pinned instance that old and
   * starts its successor only once it stopped; with this set, each shard moves to a fresh instance
   * a minute before, one shard at a time.
   */
  maxDurationSeconds?: number;
  /**
   * With `maxDurationSeconds`: warms each shard's next instance before the shard moves to it, so
   * the move does not land on a cold instance. `url` is the pinned route, and `waitUntil` the
   * middleware's own (`event.waitUntil` in Next.js). The route answers the warm-up first:
   * `if (isVercelAffinityWarmup(request))`.
   */
  warm?: { url: string | URL; waitUntil: (promise: Promise<unknown>) => void };
  now?: number;
}

// The next id this process warmed for each shard: one warm-up per shard and move.
const warmed = new Map<number, string>();

/** True for the request that starts a shard's next instance: answer it once Outpost is up. */
export const isVercelAffinityWarmup = (request: { headers: Headers }): boolean =>
  request.headers.get(WARMUP_HEADER) === "1";

const affinityId = (
  shard: number,
  shards: number,
  maxDurationSeconds: number | undefined,
  now: number,
) => {
  if (!maxDurationSeconds) return `shard-${shard}`;
  const period = Math.max(maxDurationSeconds * 500, maxDurationSeconds * 1000 - HANDOFF_MS);
  return `shard-${shard}-${Math.floor((now + (shard * period) / shards) / period)}`;
};

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
  const shards = options.shards ?? DEFAULT_SHARDS;
  const shard = jumpHash(customer, shards);
  const now = options.now ?? Date.now();
  const current = affinityId(shard, shards, options.maxDurationSeconds, now);
  headers.set(AFFINITY_HEADER, current);
  headers.set(TRUSTED_TOKEN_HEADER, token);
  const next = affinityId(shard, shards, options.maxDurationSeconds, now + WARM_MS);
  if (options.warm && next !== current && warmed.get(shard) !== next) {
    warmed.set(shard, next);
    // The request's own headers, so the warm-up passes the merchant's middleware as it did.
    const warmup = new Headers(headers);
    for (const hop of ["content-length", "transfer-encoding", "connection", "host"])
      warmup.delete(hop);
    warmup.set(AFFINITY_HEADER, next);
    warmup.set(WARMUP_HEADER, "1");
    options.warm.waitUntil(
      fetch(options.warm.url, { method: "POST", headers: warmup }).then(
        (response) => response.body?.cancel(),
        () => {},
      ),
    );
  }
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
