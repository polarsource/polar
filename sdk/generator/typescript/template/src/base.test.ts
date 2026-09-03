import { afterEach, describe, expect, test, vi } from "vitest";
import { ClientBase, resolveBaseUrl } from "./base";

const servers = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

describe("resolveBaseUrl", () => {
  test.each([
    ["production", undefined, "https://api.polar.sh"],
    ["sandbox", undefined, "https://sandbox-api.polar.sh"],
    ["invalid", "http://localhost:8000", "http://localhost:8000"],
  ])(
    "resolves %s with override %s",
    (environment, baseUrl, expected) => {
      expect(resolveBaseUrl(servers, environment, baseUrl)).toBe(expected);
    },
  );

  test("rejects invalid environments", () => {
    expect(() => resolveBaseUrl(servers, "invalid")).toThrow(
      'Invalid environment "invalid"',
    );
  });
});

const client = new ClientBase({
  baseUrl: "https://api.polar.sh",
  version: "2026-04",
  accessToken: "polar_at_u_xxx",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendRequest", () => {
  test("uses the client timeout in seconds", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ ir.versions[0].version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest(["https://api.polar.sh/v1/items/", {}]);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {
      signal: timeoutSignal,
    });
  });

  test("uses a per-request timeout override", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ ir.versions[0].version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest(
      ["https://api.polar.sh/v1/items/", {}],
      { timeout: 30 },
    );

    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  test("combines a request signal with the timeout signal", async () => {
    const requestSignal = new AbortController().signal;
    const timeoutSignal = new AbortController().signal;
    const combinedSignal = new AbortController().signal;
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const any = vi.spyOn(AbortSignal, "any").mockReturnValue(combinedSignal);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ ir.versions[0].version }}",
      accessToken: "polar_at_u_xxx",
      timeout: 10,
    });

    await client.sendRequest([
      "https://api.polar.sh/v1/items/",
      { signal: requestSignal },
    ]);

    expect(any).toHaveBeenCalledWith([requestSignal, timeoutSignal]);
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {
      signal: combinedSignal,
    });
  });

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483.648])(
    "rejects an invalid timeout of %s seconds",
    async (timeout) => {
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

      await expect(
        client.sendRequest(
          ["https://api.polar.sh/v1/items/", {}],
          { timeout },
        ),
      ).rejects.toThrow(RangeError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("uses a per-request access token override", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "2026-04",
      accessToken: "polar_at_u_xxx",
    });
    const headers = new Headers({
      Authorization: "Bearer polar_at_u_xxx",
    });

    await client.sendRequest(
      ["https://api.polar.sh/v1/items/", { headers }],
      { accessToken: "polar_at_u_override" },
    );

    const requestHeaders = fetch.mock.calls[0][1]?.headers as Headers;
    expect(requestHeaders.get("Authorization")).toBe("Bearer polar_at_u_override");
  });

  test("does not create a timeout signal when no timeout is configured", async () => {
    const client = new ClientBase({
      baseUrl: "https://api.polar.sh",
      version: "{{ ir.versions[0].version }}",
      accessToken: "polar_at_u_xxx",
      timeout: undefined,
    });

    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

    await client.sendRequest(["https://api.polar.sh/v1/items/", {}]);

    expect(timeout).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://api.polar.sh/v1/items/", {});
  });
});

describe("buildRequest", () => {
  describe("path params", () => {
    test.each([
      [{ id: "value" }, "https://api.polar.sh/v1/items/value"],
      [{ id: 123 }, "https://api.polar.sh/v1/items/123"],
      [
        { id: "value with spaces" },
        "https://api.polar.sh/v1/items/value%20with%20spaces",
      ],
    ])(
      "builds URL with path params: %p",
      (pathParams: Record<string, string | number>, expected: string) => {
        const [url] = client.buildRequest("GET", "/v1/items/{id}", pathParams);
        expect(url).toBe(expected);
      },
    );
  });

  test("query params", () => {
    const [url] = client.buildRequest("GET", "/v1/items/", undefined, {
      string_param: "value",
      bool_param: true,
      int_param: 42,
      list_param: ["a", "b", "c"],
      dict_param: { key: "value" },
    });
    expect(url).toBe(
      "https://api.polar.sh/v1/items/?string_param=value&bool_param=true&int_param=42&list_param=a&list_param=b&list_param=c&dict_param%5Bkey%5D=value",
    );
  });

  test("deep object array query params", () => {
    const [url] = client.buildRequest("GET", "/v1/items/", undefined, {
      metadata: { reference_id: ["ABC", "DEF"] },
    });
    expect(url).toBe(
      "https://api.polar.sh/v1/items/?metadata%5Breference_id%5D=ABC&metadata%5Breference_id%5D=DEF",
    );
  });

  test("null and undefined values are ignored", () => {
    const [url] = client.buildRequest(
      "GET",
      "/v1/items/{id}",
      { id: "test" },
      { null_param: null, undefined_param: undefined, valid_param: "value" },
    );
    expect(url).toBe("https://api.polar.sh/v1/items/test?valid_param=value");
  });
});
