/**
 * Outpost on Vercel: each customer's requests land on one instance, so its state stays warm there
 * and the merchant's Redis sees one set of connections per shard, not one per instance.
 */

import { digestOf, jump } from "./jump-hash";

const AFFINITY_HEADER = "x-vercel-affinity-id";
const TRUSTED_TOKEN_HEADER = "x-vercel-trusted-oidc-idp-token";
const OIDC_HEADER = "x-vercel-oidc-token";
const SHARDS = 128;

/** The customer a request is for, by Polar's id or by yours; without one it is not pinned. */
export interface VercelAffinityCustomer {
  customerId?: string | null;
  externalCustomerId?: string | null;
}

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
 * request without a customer, or outside Vercel, goes on unpinned.
 */
export const vercelAffinity =
  () =>
  async (
    init: HeadersInit,
    { customerId, externalCustomerId }: VercelAffinityCustomer,
  ): Promise<Headers> => {
    const headers = new Headers(init);
    const token = await oidcToken(headers);
    for (const name of [AFFINITY_HEADER, TRUSTED_TOKEN_HEADER]) headers.delete(name);
    const customer = externalCustomerId ?? customerId;
    if (!customer || !token) return headers;
    const shard = jump((await digestOf(customer)).getBigUint64(0), SHARDS);
    headers.set(AFFINITY_HEADER, `shard-${shard}`);
    headers.set(TRUSTED_TOKEN_HEADER, token);
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
