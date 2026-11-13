import { describe, expect, it } from "vitest";

import { jumpHash } from "./jump-hash";
import { vercelAffinity } from "./vercel";

const incoming = { "x-vercel-oidc-token": "oidc", authorization: "Basic merchant" };

describe("vercelAffinity", () => {
  it("pins a known customer to its shard and vouches for it with the request's OIDC token", async () => {
    const headers = await vercelAffinity()(incoming, { externalCustomerId: "customer-7" });
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
});
