import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startRedisServer, type RedisServer } from "./testing";
import { isVercelAffinityWarmup, jumpHash, vercelAffinityHeaders } from "./vercel";

const customers = Array.from({ length: 1000 }, (_, index) => `customer-${index}`);
const url = "https://app.test/api/meter";
const request = (headers: HeadersInit) => ({ headers: new Headers(headers), url });
const waited: Promise<unknown>[] = [];
const event = { waitUntil: (promise: Promise<unknown>) => void waited.push(promise) };
let fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  waited.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

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
    const headers = await vercelAffinityHeaders(request(incoming), event, {
      externalCustomerId: "customer-7",
    });
    expect(headers.get("x-vercel-affinity-id")).toBe(`shard-${jumpHash("customer-7", 64)}`);
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(headers.get("authorization")).toBe("Bearer token");
  });

  it("leaves a request without a customer or a token unpinned, so it scales as before", async () => {
    expect(
      (await vercelAffinityHeaders(request(incoming), event, {})).has("x-vercel-affinity-id"),
    ).toBe(false);
    const tokenless = await vercelAffinityHeaders(request({}), event, {
      externalCustomerId: "customer-7",
    });
    expect(tokenless.has("x-vercel-affinity-id")).toBe(false);
  });

  it("moves a shard to a fresh instance a minute before Vercel would retire its own", async () => {
    const options = { externalCustomerId: "customer-7", maxDurationSeconds: 300 };
    const at = async (now: number) =>
      (await vercelAffinityHeaders(request(incoming), event, { ...options, now })).get(
        "x-vercel-affinity-id",
      );
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

  it("moves a shard's customers to its next instance one by one, over 30 s", async () => {
    const shard = customers.filter((customer) => jumpHash(customer, 64) === 0);
    const moveOf = async (customer: string) => {
      const options = { externalCustomerId: customer, maxDurationSeconds: 300 };
      const at = async (second: number) =>
        (
          await vercelAffinityHeaders(request(incoming), event, { ...options, now: second * 1000 })
        ).get("x-vercel-affinity-id");
      const moves: number[] = [];
      for (let second = 101; second < 400; second += 1)
        if ((await at(second)) !== (await at(second - 1))) moves.push(second);
      return moves;
    };
    const moves = await Promise.all(shard.map(moveOf));
    expect(moves.every((each) => each.length === 1)).toBe(true);
    const seconds = moves.flat();
    expect(new Set(seconds).size).toBeGreaterThan(shard.length / 2);
    expect(Math.max(...seconds) - Math.min(...seconds)).toBeLessThanOrEqual(30);
  });
});

describe("warm-up", () => {
  const incoming = { "x-vercel-oidc-token": "oidc", authorization: "Basic merchant" };

  it("warms a shard's next instance once, in the 30 s before the shard moves to it", async () => {
    const base = { externalCustomerId: "customer-warm", maxDurationSeconds: 300 };
    const at = (second: number) =>
      vercelAffinityHeaders(request(incoming), event, { ...base, now: second * 1000 });
    const idAt = async (second: number) => (await at(second)).get("x-vercel-affinity-id");
    // Far from the other tests' moves; the move after the first one found is not warmed yet.
    let move = 100_001;
    while ((await idAt(move)) === (await idAt(move - 1))) move += 1;
    move += 240;
    await Promise.all(waited);
    fetchMock.mockClear();

    await at(move - 60);
    expect(fetchMock).not.toHaveBeenCalled();
    await at(move - 15);
    await at(move - 5);
    await Promise.all(waited);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(target).toBe(url);
    expect(headers.get("x-vercel-affinity-id")).toBe(await idAt(move));
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(isVercelAffinityWarmup(new Request(url, { method: "POST", headers }))).toBe(true);
    // It passes the merchant's middleware as the request that sent it, and stays on the next id.
    expect(headers.get("authorization")).toBe("Basic merchant");
    const again = await vercelAffinityHeaders({ headers, url }, event, {
      ...base,
      now: (move - 10) * 1000,
    });
    expect(again.get("x-vercel-affinity-id")).toBe(await idAt(move));
  });

  it("tells a warm-up apart from the merchant's own requests", () => {
    expect(isVercelAffinityWarmup(new Request(url))).toBe(false);
  });
});

describe("shard count", () => {
  const incoming = { "x-vercel-oidc-token": "oidc" };
  let redisServer: RedisServer;
  beforeAll(async () => {
    redisServer = await startRedisServer();
  });
  afterAll(() => redisServer?.stop());

  it("grows with the load: it warms the new shards, then moves their customers over", async () => {
    const shardOf = (id: string | null) => Number(id?.split("-")[1]);
    const shardAt = async (customer: string, now: number) =>
      shardOf(
        (
          await vercelAffinityHeaders(request(incoming), event, {
            externalCustomerId: customer,
            redisUrl: redisServer.socket,
            maxDurationSeconds: 300,
            now,
          })
        ).get("x-vercel-affinity-id"),
      );
    const everyone = async (now: number) => {
      const shards = await Promise.all(customers.map((customer) => shardAt(customer, now)));
      await Promise.all(waited);
      return shards;
    };

    // 4,000 requests a second for 10 s: more than 64 shards take at 50 a second each.
    const start = 1_000_000;
    for (let second = 0; second < 10; second += 1) {
      await Promise.all(
        Array.from({ length: 4000 }, (_, index) =>
          shardAt(customers[index % customers.length], start + second * 1000 + index / 4),
        ),
      );
      await Promise.all(waited);
    }
    await everyone(start + 10_000);
    expect(await everyone(start + 11_000)).toEqual(
      customers.map((customer) => jumpHash(customer, 64)),
    );
    const warmed = (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) =>
      shardOf(new Headers(init.headers).get("x-vercel-affinity-id")),
    );
    const added = [...new Set(warmed.filter((shard) => shard >= 64))].sort((a, b) => a - b);
    const shards = 64 + added.length;
    expect(added).toEqual(added.map((_, index) => 64 + index));
    expect(shards).toBeGreaterThanOrEqual(70);
    expect(shards).toBeLessThanOrEqual(75);

    const later = await everyone(start + 80_000);
    expect(later).toEqual(customers.map((customer) => jumpHash(customer, shards)));
    expect(later.filter((shard) => shard >= 64).length).toBeGreaterThan(0);
  });
});
