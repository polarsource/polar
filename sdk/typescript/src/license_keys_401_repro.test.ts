import { afterEach, describe, expect, test, vi } from "vitest";

import { createPolar } from "./2026-04/client";
import { Unauthorized } from "./2026-04/errors";
import { PolarClientError } from "./base";

const polar = createPolar({
  accessToken: "polar_oat_xxx",
  baseUrl: "https://api.polar.sh",
});

const ORG = "00000000-0000-0000-0000-000000000000";
const ACT = "11111111-1111-1111-1111-111111111111";

const unauthorizedResponse = () =>
  new Response(JSON.stringify({ error: "Unauthorized", detail: "Not authenticated" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("licenseKeys admin endpoints throw typed Unauthorized on 401", () => {
  test("validate throws Unauthorized (not bare PolarClientError)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorizedResponse());
    let caught: unknown;
    try {
      await polar.licenseKeys.validate({ key: "TEST-KEY", organization_id: ORG });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Unauthorized);
    expect(caught).toBeInstanceOf(PolarClientError);
    expect((caught as PolarClientError).statusCode).toBe(401);
  });

  test("activate throws Unauthorized (not bare PolarClientError)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorizedResponse());
    let caught: unknown;
    try {
      await polar.licenseKeys.activate({
        key: "TEST-KEY",
        organization_id: ORG,
        label: "node-1",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Unauthorized);
    expect((caught as PolarClientError).statusCode).toBe(401);
  });

  test("deactivate throws Unauthorized (not bare PolarClientError)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorizedResponse());
    let caught: unknown;
    try {
      await polar.licenseKeys.deactivate({
        key: "TEST-KEY",
        organization_id: ORG,
        activation_id: ACT,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Unauthorized);
    expect((caught as PolarClientError).statusCode).toBe(401);
  });
});
