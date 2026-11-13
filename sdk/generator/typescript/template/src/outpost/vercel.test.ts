import { describe, expect, it } from "vitest";

import { jumpHash, vercelAffinityHeaders } from "./vercel";

const customers = Array.from({ length: 1000 }, (_, index) => `customer-${index}`);

describe("jumpHash", () => {
  it("spreads customers over every shard and keeps each one on its shard", () => {
    const shards = customers.map((customer) => jumpHash(customer, 64));
    expect(customers.map((customer) => jumpHash(customer, 64))).toEqual(shards);
    const sizes = [...new Set(shards)].map(
      (shard) => shards.filter((each) => each === shard).length,
    );
    expect(sizes).toHaveLength(64);
    expect(Math.min(...sizes)).toBeGreaterThan(3);
    expect(Math.max(...sizes)).toBeLessThan(35);
  });

  it("moves only the customers the new shard takes when the count grows", () => {
    const moved = customers.filter((customer) => jumpHash(customer, 64) !== jumpHash(customer, 65));
    expect(moved.length).toBeLessThan(customers.length / 20);
    expect(moved.every((customer) => jumpHash(customer, 65) === 64)).toBe(true);
  });
});

describe("vercelAffinityHeaders", () => {
  const incoming = { "x-vercel-oidc-token": "oidc", authorization: "Bearer token" };

  it("pins a known customer to its shard and vouches for it with the request's OIDC token", async () => {
    const headers = await vercelAffinityHeaders(incoming, {
      externalCustomerId: "customer-7",
      shards: 64,
    });
    expect(headers.get("x-vercel-affinity-id")).toBe(`shard-${jumpHash("customer-7", 64)}`);
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(headers.get("authorization")).toBe("Bearer token");
  });

  it("leaves a request without a customer or a token unpinned, so it scales as before", async () => {
    expect((await vercelAffinityHeaders(incoming, {})).has("x-vercel-affinity-id")).toBe(false);
    const tokenless = await vercelAffinityHeaders({}, { externalCustomerId: "customer-7" });
    expect(tokenless.has("x-vercel-affinity-id")).toBe(false);
  });

  it("moves a shard to a fresh instance a minute before Vercel would retire its own", async () => {
    const options = { externalCustomerId: "customer-7", shards: 64, maxDurationSeconds: 300 };
    const at = async (now: number) =>
      (await vercelAffinityHeaders(incoming, { ...options, now })).get("x-vercel-affinity-id");
    const ids = await Promise.all(Array.from({ length: 1000 }, (_, second) => at(second * 1000)));
    const moves = ids.flatMap((id, second) =>
      second > 0 && id !== ids[second - 1] ? [second] : [],
    );
    expect(moves.length).toBeGreaterThan(2);
    expect(moves.slice(1).map((second, index) => second - moves[index])).toEqual(
      moves.slice(1).map(() => 240),
    );
    expect(ids[0]).toMatch(/^shard-\d+-\d+$/);
  });
});
