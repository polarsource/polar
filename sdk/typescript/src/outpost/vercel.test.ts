import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jumpHash } from "./jump-hash";
import { isVercelAffinityWarmup, vercelAffinity, warmNextVercelInstance } from "./vercel";

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
  return pin(request(headers), { externalCustomerId: customer });
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

  it("spreads the customers over as many shards as it is given", async () => {
    const headers = await headersAt(vercelAffinity({ shards: 256 }), "customer-0", 0);
    expect(headers.get("x-vercel-affinity-id")).toBe(`shard-${await jumpHash("customer-0", 256)}`);
  });

  it("leaves a request without a customer or a token unpinned, so it scales as before", async () => {
    const pin = vercelAffinity();
    const stale = { "x-vercel-affinity-id": "shard-9", "x-vercel-trusted-oidc-idp-token": "stale" };
    const unknown = await pin(request({ ...incoming, ...stale }), {});
    const tokenless = await pin(request(stale), { externalCustomerId: "customer-7" });
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
  it("tells a warm-up apart from the merchant's own requests", () => {
    expect(isVercelAffinityWarmup(new Request(url))).toBe(false);
  });
});

describe("warm-up from the pinned route", () => {
  // The first second the customer's id changes, late enough for a warm-up window before it.
  const moveOf = async (customer: string) =>
    (await movesOf(vercelAffinity({ maxDurationSeconds: 300 }), customer, 60, 360))[0];
  const route = (headers: Headers) => new Request(url, { method: "POST", headers });
  // The seconds of the customer's first move in which it is still on its current instance and the
  // middleware names the next one: one window, one next id.
  const windowOf = async (pin: Pin, customer: string) => {
    const seconds: number[] = [];
    for (let second = 60; second < 360; second += 1) {
      const headers = await headersAt(pin, customer, second);
      const next = headers.get("x-polar-affinity-next");
      if (next && next !== headers.get("x-vercel-affinity-id")) seconds.push(second);
      else if (seconds.length) break;
    }
    return seconds;
  };

  it("names a shard's next instance in the 30 s before the shard moves to it", async () => {
    const move = await moveOf("customer-next");
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const next = await idAt(pin, "customer-next", move);
    fetchMock.mockClear();

    expect((await headersAt(pin, "customer-next", move - 60)).has("x-polar-affinity-next")).toBe(
      false,
    );
    expect((await headersAt(pin, "customer-next", move - 15)).get("x-polar-affinity-next")).toBe(
      next,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warms the next instance once, from the instance that holds the shard", async () => {
    const move = await moveOf("customer-route");
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const next = await idAt(pin, "customer-route", move);
    fetchMock.mockClear();
    waited.length = 0;

    for (const second of [move - 20, move - 10]) {
      warmNextVercelInstance(
        route(await headersAt(pin, "customer-route", second)),
        event.waitUntil,
      );
    }
    await Promise.all(waited);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(target).toBe(url);
    expect(headers.get("x-vercel-affinity-id")).toBe(next);
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(headers.get("authorization")).toBe("Basic merchant");
    expect(headers.has("x-polar-affinity-next")).toBe(false);
    expect(isVercelAffinityWarmup({ headers })).toBe(true);
    const passed = await headersAt(pin, "customer-route", move - 10, headers);
    expect(passed.get("x-vercel-affinity-id")).toBe(next);
  });

  it.each([
    ["is offline", () => fetchMock.mockRejectedValueOnce(new Error("offline"))],
    ["answers 503", () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))],
  ])("warms again when the next instance %s", async (failure, fail) => {
    const customer = `customer-${failure.replace(/\W/g, "-")}`;
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const window = await windowOf(pin, customer);
    fetchMock.mockClear();
    fail();
    waited.length = 0;

    for (const second of [window[0], window.at(-1)!]) {
      warmNextVercelInstance(route(await headersAt(pin, customer, second)), event.waitUntil);
      await Promise.all(waited);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits a second before warming again after a failure", async () => {
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const [first, second] = await windowOf(pin, "customer-throttled");
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    waited.length = 0;

    for (const at of [first, first, second]) {
      warmNextVercelInstance(
        route(await headersAt(pin, "customer-throttled", at)),
        event.waitUntil,
      );
      await Promise.all(waited);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never warms its own instance", () => {
    fetchMock.mockClear();
    const own = { "x-vercel-affinity-id": "shard-3-9", "x-polar-affinity-next": "shard-3-9" };
    warmNextVercelInstance(route(new Headers({ ...incoming, ...own })), event.waitUntil);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
