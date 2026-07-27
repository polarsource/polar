import { describe, expect, test } from "vitest";
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
