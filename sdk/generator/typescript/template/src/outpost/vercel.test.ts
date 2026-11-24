import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  vi.restoreAllMocks();
});

type Pin = ReturnType<typeof vercelAffinity>;

// Every request draws its shard, then its moment in the shard's move: `spread` 0.5 moves with the shard.
const draw = (shard: number, spread = 0.5, shards = 128) => {
  let call = 0;
  vi.spyOn(Math, "random").mockImplementation(() =>
    call++ % 2 === 0 ? (shard + 0.5) / shards : spread,
  );
};

const headersAt = (pin: Pin, second: number, headers: HeadersInit = incoming) => {
  vi.setSystemTime(second * 1000);
  return pin(request(headers));
};

const idAt = async (pin: Pin, second: number) =>
  (await headersAt(pin, second)).get("x-vercel-affinity-id");

// The seconds at which the drawn shard's id changes, from `from` to `to`.
const movesOf = async (pin: Pin, from: number, to: number) => {
  const moves: number[] = [];
  let previous = await idAt(pin, from);
  for (let second = from + 1; second < to; second += 1) {
    const id = await idAt(pin, second);
    if (id !== previous) moves.push(second);
    previous = id;
  }
  return moves;
};

describe("vercelAffinity", () => {
  it("pins a request to the shard it draws and vouches for it with the request's OIDC token", async () => {
    draw(7);
    const headers = await headersAt(vercelAffinity(), 0);
    expect(headers.get("x-vercel-affinity-id")).toBe("shard-7");
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe("oidc");
    expect(headers.get("authorization")).toBe("Basic merchant");
  });

  it("spreads the requests over every shard it is given, whoever they are for", async () => {
    const pin = vercelAffinity({ shards: 8 });
    const ids = new Set<string | null>();
    for (let index = 0; index < 1000; index += 1) ids.add(await idAt(pin, 0));
    expect([...ids].sort()).toEqual(Array.from({ length: 8 }, (_, shard) => `shard-${shard}`));
  });

  it("leaves a request without a token unpinned, so it scales as before", async () => {
    const stale = { "x-vercel-affinity-id": "shard-9", "x-vercel-trusted-oidc-idp-token": "stale" };
    const headers = await vercelAffinity()(request(stale));
    expect(headers.has("x-vercel-affinity-id")).toBe(false);
    expect(headers.has("x-vercel-trusted-oidc-idp-token")).toBe(false);
  });

  it("moves a shard to a fresh instance a minute before Vercel would retire its own", async () => {
    draw(7);
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const moves = await movesOf(pin, 0, 1000);
    expect(moves.length).toBeGreaterThan(2);
    expect(moves.slice(1).map((second, index) => second - moves[index])).toEqual(
      moves.slice(1).map(() => 240),
    );
    expect(await idAt(pin, 0)).toMatch(/^shard-\d+-\d+$/);
  });

  it("moves a shard's requests to its next instance one by one, over 30 s", async () => {
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const moves = [];
    for (const spread of [0, 0.25, 0.5, 0.75, 0.999]) {
      draw(0, spread);
      moves.push(await movesOf(pin, 100, 400));
    }
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
  // The first second the drawn shard's id changes, late enough for a warm-up window before it.
  const moveOf = async () => (await movesOf(vercelAffinity({ maxDurationSeconds: 300 }), 60, 360))[0];
  const route = (headers: Headers) => new Request(url, { method: "POST", headers });
  // The seconds of the drawn shard's first move in which a request is still on its current
  // instance and the middleware names the next one: one window, one next id.
  const windowOf = async (pin: Pin) => {
    const seconds: number[] = [];
    for (let second = 60; second < 360; second += 1) {
      const headers = await headersAt(pin, second);
      const next = headers.get("x-polar-affinity-next");
      if (next && next !== headers.get("x-vercel-affinity-id")) seconds.push(second);
      else if (seconds.length) break;
    }
    return seconds;
  };

  it("names a shard's next instance in the 30 s before the shard moves to it", async () => {
    draw(11);
    const move = await moveOf();
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const next = await idAt(pin, move);
    fetchMock.mockClear();

    expect((await headersAt(pin, move - 60)).has("x-polar-affinity-next")).toBe(false);
    expect((await headersAt(pin, move - 15)).get("x-polar-affinity-next")).toBe(next);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warms the next instance once, from the instance that holds the shard", async () => {
    draw(12);
    const move = await moveOf();
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const next = await idAt(pin, move);
    fetchMock.mockClear();
    waited.length = 0;

    for (const second of [move - 20, move - 10]) {
      warmNextVercelInstance(route(await headersAt(pin, second)), event.waitUntil);
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
    const passed = await headersAt(pin, move - 10, headers);
    expect(passed.get("x-vercel-affinity-id")).toBe(next);
  });

  it.each([
    ["is offline", 13, () => fetchMock.mockRejectedValueOnce(new Error("offline"))],
    ["answers 503", 14, () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))],
  ])("warms again when the next instance %s", async (_, shard, fail) => {
    draw(shard);
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const window = await windowOf(pin);
    fetchMock.mockClear();
    fail();
    waited.length = 0;

    for (const second of [window[0], window.at(-1)!]) {
      warmNextVercelInstance(route(await headersAt(pin, second)), event.waitUntil);
      await Promise.all(waited);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits a second before warming again after a failure", async () => {
    draw(15);
    const pin = vercelAffinity({ maxDurationSeconds: 300 });
    const [first, second] = await windowOf(pin);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    waited.length = 0;

    for (const at of [first, first, second]) {
      warmNextVercelInstance(route(await headersAt(pin, at)), event.waitUntil);
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
