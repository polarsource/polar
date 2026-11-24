/**
 * Outpost on Vercel: each request lands on one of a fixed set of shards, so the merchant's Redis
 * sees one set of connections per shard, not one per instance. Outpost's state lives in Redis, so
 * any shard serves any customer: each request draws its own, and a busy customer spreads over all
 * of them.
 */

const AFFINITY_HEADER = "x-vercel-affinity-id";
const TRUSTED_TOKEN_HEADER = "x-vercel-trusted-oidc-idp-token";
const OIDC_HEADER = "x-vercel-oidc-token";
const WARMUP_HEADER = "x-polar-affinity-warmup";
const NEXT_HEADER = "x-polar-affinity-next";
const DEFAULT_SHARDS = 128;
// A shard moves to a fresh instance this long before Vercel would retire its own.
const HANDOFF_MS = 60_000;
// The shard's next instance starts this long before the shard moves to it.
const WARM_MS = 30_000;
// Temporary, while Vercel answers 503 to a fresh pinned instance that takes a whole shard at once:
// each request moves at its own moment within this window around its shard's move. The last
// leave 15 s before Vercel retires the instance, which started with its warm-up.
const SPREAD_MS = 30_000;

export interface VercelAffinityOptions {
  /**
   * The pinned functions' `maxDuration`, in seconds. Vercel retires a pinned instance that old and
   * starts its successor only once it stopped; with this set, each shard moves to a fresh instance
   * a minute before, one shard at a time, and its next instance gets one request first.
   */
  maxDurationSeconds?: number;
  /** How many shards, so how many pinned instances, the requests spread over. Defaults to 128. */
  shards?: number;
}

/** The pinned route's request: its URL, and the headers the middleware passed on. */
export interface VercelAffinityRequest {
  headers: Headers;
  url: string | URL;
}

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
 * Pins each request to one of `shards` shards, at random: the middleware passes on the headers it
 * returns, for the routes that read Outpost. A request outside Vercel goes on unpinned. The route
 * answers a warm-up before anything else, then warms the shard's next instance:
 * `if (isVercelAffinityWarmup(request))`, then `warmNextVercelInstance(request, after)`.
 */
export const vercelAffinity =
  ({ maxDurationSeconds, shards = DEFAULT_SHARDS }: VercelAffinityOptions = {}) =>
  async (request: { headers: Headers }): Promise<Headers> => {
    const headers = new Headers(request.headers);
    // A warm-up already names the shard's next instance: re-pinning it would send it to the current one.
    if (isVercelAffinityWarmup({ headers })) return headers;
    for (const name of [AFFINITY_HEADER, TRUSTED_TOKEN_HEADER, NEXT_HEADER]) headers.delete(name);
    const token = await oidcToken(headers);
    if (!token) return headers;
    const now = Date.now();
    const shard = Math.floor(Math.random() * shards);
    const current = affinityId(shard, shards, maxDurationSeconds, now);
    const skew = (Math.random() - 0.5) * SPREAD_MS;
    headers.set(AFFINITY_HEADER, affinityId(shard, shards, maxDurationSeconds, now - skew));
    headers.set(TRUSTED_TOKEN_HEADER, token);
    const next = affinityId(shard, shards, maxDurationSeconds, now + WARM_MS);
    if (next !== current) headers.set(NEXT_HEADER, next);
    return headers;
  };

// After a failed warm-up, wait this long before trying again.
const WARMUP_RETRY_MS = 1_000;
// Next id -> earliest time to warm it again. Infinity once a warm-up has started.
const warmups = new Map<string, number>();

/**
 * Starts the shard's next instance from the one that holds the shard, in the 30 s before the shard
 * moves to it. Call it in the pinned route with the route's `waitUntil` (`after` in Next.js).
 */
export const warmNextVercelInstance = (
  request: VercelAffinityRequest,
  waitUntil: (promise: Promise<unknown>) => void,
): void => {
  const next = request.headers.get(NEXT_HEADER);
  if (!next || next === request.headers.get(AFFINITY_HEADER)) return;
  if ((warmups.get(next) ?? 0) > Date.now()) return;
  warmups.set(next, Infinity);
  // The request's own headers, so the warm-up passes the merchant's middleware as it did.
  const headers = new Headers(request.headers);
  for (const name of ["content-length", "transfer-encoding", "connection", "host", NEXT_HEADER])
    headers.delete(name);
  headers.set(AFFINITY_HEADER, next);
  headers.set(WARMUP_HEADER, "1");
  waitUntil(
    fetch(request.url, { method: "POST", headers })
      .then(async (response) => {
        await response.body?.cancel();
        return response.ok;
      })
      .catch(() => false)
      .then((warm) => {
        if (!warm) warmups.set(next, Date.now() + WARMUP_RETRY_MS);
      }),
  );
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
