import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jumpHash } from "./jump-hash";
import { vercelAffinity } from "./vercel";

const incoming = { "x-vercel-oidc-token": "oidc", authorization: "Basic merchant" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

type Pin = ReturnType<typeof vercelAffinity>;

const headersAt = (pin: Pin, customer: string, second: number, headers: HeadersInit = incoming) => {
  vi.setSystemTime(second * 1000);
  return pin(headers, { externalCustomerId: customer });
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
    const unknown = await pin({ ...incoming, ...stale }, {});
    const tokenless = await pin(stale, { externalCustomerId: "customer-7" });
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
});
