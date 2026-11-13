import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jumpHash } from "./jump-hash";
import { isVercelAffinityWarmup, vercelAffinity } from "./vercel";

const url = "https://app.test/api/meter";
const incoming = { "x-vercel-oidc-token": "oidc", authorization: "Basic merchant" };
const request = (headers: HeadersInit) => ({ headers: new Headers(headers), url });
const waited: Promise<unknown>[] = [];
const event = { waitUntil: (promise: Promise<unknown>) => void waited.push(promise) };
let fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  waited.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Pin = ReturnType<typeof vercelAffinity>;

const headersAt = (pin: Pin, customer: string, second: number, headers: HeadersInit = incoming) => {
  vi.setSystemTime(second * 1000);
  return pin(request(headers), event, { externalCustomerId: customer });
};

const idAt = async (pin: Pin, customer: string, second: number) =>
  (await headersAt(pin, customer, second)).get("x-vercel-affinity-id");

// The seconds at which the customer's id changes, from `from` to `to`.
const movesOf = async (pin: Pin, customer: string, from: number, to: number) => {
  const moves: number[] = [];
  let previous = await idAt(pin, customer, from);
  for (let second = from + 1; second < to; second += 1) {
    const id = await idAt(pin, customer, second);
    if (id !== previous) moves.push(second);
    previous = id;
  }
  return moves;
};

describe("vercelAffinity", () => {
  it("pins a known customer to its shard and vouches for it with the request's OIDC token", async () => {
    const headers = await headersAt(vercelAffinity(), "customer-7", 0);
    expect(headers.get("x-vercel-affinity-id")).toBe(`shard-${await jumpHash("customer-7", 128)}`);
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(headers.get("authorization")).toBe("Basic merchant");
  });

  it("leaves a request without a customer or a token unpinned, so it scales as before", async () => {
    const pin = vercelAffinity();
    const stale = { "x-vercel-affinity-id": "shard-9", "x-vercel-trusted-oidc-idp-token": "stale" };
    const unknown = await pin(request({ ...incoming, ...stale }), event, {});
    const tokenless = await pin(request(stale), event, { externalCustomerId: "customer-7" });
    for (const headers of [unknown, tokenless]) {
      expect(headers.has("x-vercel-affinity-id")).toBe(false);
      expect(headers.has("x-vercel-trusted-oidc-idp-token")).toBe(false);
    }
  });

  it("moves a shard to a fresh instance a minute before Vercel would retire its own", async () => {
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const moves = await movesOf(pin, "customer-7", 0, 1000);
    expect(moves.length).toBeGreaterThan(2);
    expect(moves.slice(1).map((second, index) => second - moves[index])).toEqual(
      moves.slice(1).map(() => 240),
    );
    expect(await idAt(pin, "customer-7", 0)).toMatch(/^shard-\d+-\d+$/);
  });

  it("moves a shard's customers to its next instance one by one, over 30 s", async () => {
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const customers = Array.from({ length: 5000 }, (_, index) => `customer-${index}`);
    const shards = await Promise.all(customers.map((customer) => jumpHash(customer, 128)));
    const shard = customers.filter((_, index) => shards[index] === 0);
    const moves = [];
    for (const customer of shard) moves.push(await movesOf(pin, customer, 100, 400));
    expect(moves.every((each) => each.length === 1)).toBe(true);
    const seconds = moves.flat();
    expect(Math.max(...seconds) - Math.min(...seconds)).toBeGreaterThan(20);
    expect(Math.max(...seconds) - Math.min(...seconds)).toBeLessThanOrEqual(30);
  });
});

describe("warm-up", () => {
  // The first second the customer's id changes, from a middleware of its own.
  const moveOf = async (customer: string) =>
    (await movesOf(vercelAffinity({ maxDurationSeconds: 300 }), customer, 0, 300))[0];

  it("warms a shard's next instance once, in the 30 s before the shard moves to it", async () => {
    const move = await moveOf("customer-warm");
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const next = await idAt(vercelAffinity({ maxDurationSeconds: 300 }), "customer-warm", move);
    waited.length = 0;
    fetchMock.mockClear();

    await headersAt(pin, "customer-warm", move - 60);
    expect(fetchMock).not.toHaveBeenCalled();
    await headersAt(pin, "customer-warm", move - 15);
    await headersAt(pin, "customer-warm", move - 5);
    expect(waited).toHaveLength(1);
    await Promise.all(waited);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(target).toBe(url);
    expect(headers.get("x-vercel-affinity-id")).toBe(next);
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(isVercelAffinityWarmup(new Request(url, { method: "POST", headers }))).toBe(true);
    // It passes the merchant's middleware as the request that sent it, and stays on the next id.
    expect(headers.get("authorization")).toBe("Basic merchant");
    // Another instance of the middleware may take it, with a token of its own.
    headers.set("x-vercel-oidc-token", "another-instance");
    const again = await headersAt(pin, "customer-warm", move - 10, headers);
    expect(again.get("x-vercel-affinity-id")).toBe(next);
  });

  it("warms again in the same window when a warm-up fails", async () => {
    const move = await moveOf("customer-retry");
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    fetchMock.mockClear();
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await headersAt(pin, "customer-retry", move - 20);
    await Promise.all(waited);
    await headersAt(pin, "customer-retry", move - 10);
    await Promise.all(waited);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tells a warm-up apart from the merchant's own requests", () => {
    expect(isVercelAffinityWarmup(new Request(url))).toBe(false);
  });
});
