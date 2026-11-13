/**
 * Outpost on Vercel: each customer's requests land on one instance, so its state stays warm there
 * and the merchant's Redis sees one set of connections per shard, not one per instance.
 */

import { digestOf, jump } from "./jump-hash";

const AFFINITY_HEADER = "x-vercel-affinity-id";
const TRUSTED_TOKEN_HEADER = "x-vercel-trusted-oidc-idp-token";
const OIDC_HEADER = "x-vercel-oidc-token";
const WARMUP_HEADER = "x-polar-affinity-warmup";
const SHARDS = 128;
// A shard moves to a fresh instance this long before Vercel would retire its own.
const HANDOFF_MS = 60_000;
// The shard's next instance starts this long before the shard moves to it.
const WARM_MS = 30_000;
// Temporary, while Vercel answers 503 to a fresh pinned instance that takes a whole shard at once:
// each customer moves at its own moment within this window around its shard's move. The last
// leave 15 s before Vercel retires the instance, which started with its warm-up.
const SPREAD_MS = 30_000;

export interface VercelAffinityOptions {
  /**
   * The pinned functions' `maxDuration`, in seconds. Vercel retires a pinned instance that old and
   * starts its successor only once it stopped; with this set, each shard moves to a fresh instance
   * a minute before, one shard at a time, and its next instance gets one request first.
   */
  maxDurationSeconds?: number;
}

/** The customer a request is for, by Polar's id or by yours; without one it is not pinned. */
export interface VercelAffinityCustomer {
  customerId?: string | null;
  externalCustomerId?: string | null;
}

/** The middleware's request: the pinned route, and the headers to pass on. */
export interface VercelAffinityRequest {
  headers: Headers;
  url: string | URL;
}

/** The middleware's event (`NextFetchEvent` in Next.js): its `waitUntil` carries the warm-ups. */
export interface VercelAffinityEvent {
  waitUntil(promise: Promise<unknown>): void;
}

/** True for the request that starts a shard's next instance: answer it once Outpost is up. */
export const isVercelAffinityWarmup = (request: { headers: Headers }): boolean =>
  request.headers.get(WARMUP_HEADER) === "1";

const affinityId = (shard: number, maxDurationSeconds: number | undefined, now: number) => {
  if (!maxDurationSeconds) return `shard-${shard}`;
  const period = Math.max(maxDurationSeconds * 500, maxDurationSeconds * 1000 - HANDOFF_MS);
  return `shard-${shard}-${Math.floor((now + (shard * period) / SHARDS) / period)}`;
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
 * Pins each customer to one of 128 shards: the middleware passes on the headers it returns. A
 * request without a customer, or outside Vercel, goes on unpinned. The route answers a warm-up
 * before anything else: `if (isVercelAffinityWarmup(request))`.
 */
export const vercelAffinity = ({ maxDurationSeconds }: VercelAffinityOptions = {}) => {
  // The next id this middleware warmed for each shard: one warm-up per shard and move.
  const warmed = new Map<number, string>();
  return async (
    request: VercelAffinityRequest,
    event: VercelAffinityEvent,
    { customerId, externalCustomerId }: VercelAffinityCustomer,
  ): Promise<Headers> => {
    const headers = new Headers(request.headers);
    // A warm-up already names the shard's next instance: re-pinning it would send it to the current one.
    if (isVercelAffinityWarmup({ headers })) return headers;
    for (const name of [AFFINITY_HEADER, TRUSTED_TOKEN_HEADER]) headers.delete(name);
    const customer = externalCustomerId ?? customerId;
    if (!customer) return headers;
    const token = await oidcToken(headers);
    if (!token) return headers;
    const now = Date.now();
    const digest = await digestOf(customer);
    const shard = jump(digest.getBigUint64(0), SHARDS);
    const current = affinityId(shard, maxDurationSeconds, now);
    // Where in the spread the customer moves: other bits of its digest than the ones of its shard.
    const skew = (Number(digest.getBigUint64(8) >> 11n) / 2 ** 53 - 0.5) * SPREAD_MS;
    headers.set(AFFINITY_HEADER, affinityId(shard, maxDurationSeconds, now - skew));
    headers.set(TRUSTED_TOKEN_HEADER, token);
    const next = affinityId(shard, maxDurationSeconds, now + WARM_MS);
    if (next !== current && warmed.get(shard) !== next) {
      warmed.set(shard, next);
      // The request's own headers, so the warm-up passes the merchant's middleware as it did.
      const warmup = new Headers(headers);
      for (const hop of ["content-length", "transfer-encoding", "connection", "host"])
        warmup.delete(hop);
      warmup.set(AFFINITY_HEADER, next);
      warmup.set(WARMUP_HEADER, "1");
      event.waitUntil(
        fetch(request.url, { method: "POST", headers: warmup }).then(
          (response) => response.body?.cancel(),
          () => {
            // The next request in the window tries again.
            if (warmed.get(shard) === next) warmed.delete(shard);
          },
        ),
      );
    }
    return headers;
  };
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
