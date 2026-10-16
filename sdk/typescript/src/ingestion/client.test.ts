import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";

import { createPolar } from "../2026-10/client";
import { Ingestion, type IngestionStrategy } from "./client";

const event = { name: "usage", external_customer_id: "alice" };

afterEach(() => vi.restoreAllMocks());

it("starts and ingests in order, then closes in reverse order", async () => {
  const calls: string[] = [];
  const strategies: IngestionStrategy[] = ["buffered", "local"].map((name) => ({
    async start() {
      calls.push(`start:${name}`);
    },
    async ingest(value) {
      expect(value).toBe(event);
      calls.push(`ingest:${name}`);
    },
    async close() {
      calls.push(`close:${name}`);
    },
  }));
  {
    await using ingestion = await new Ingestion({ strategies }).start();
    await ingestion.ingest(event);
  }
  expect(calls).toEqual([
    "start:buffered",
    "start:local",
    "ingest:buffered",
    "ingest:local",
    "close:local",
    "close:buffered",
  ]);
});

it("cleans up when startup fails and closes every strategy despite cleanup errors", async () => {
  const first = {
    start: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn(),
    close: vi.fn().mockRejectedValue(new Error("close failed")),
  };
  const second = { ...first, close: vi.fn().mockResolvedValue(undefined) };
  const third = { ...second, start: vi.fn().mockRejectedValue(new Error("start failed")) };
  const ingestion = new Ingestion({ strategies: [first, second, third] });
  await expect(ingestion.start()).rejects.toThrow("close failed");
  expect(second.close).toHaveBeenCalledOnce();
  expect(first.close).toHaveBeenCalledOnce();
});

it("stops at the failing strategy and rejects ingestion outside its lifecycle", async () => {
  const first = {
    start: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockRejectedValue(new Error("ingest failed")),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const second = { ...first, ingest: vi.fn() };
  const ingestion = new Ingestion({ strategies: [first, second] });
  await expect(ingestion.ingest(event)).rejects.toThrow("not running");
  await ingestion.start();
  await expect(ingestion.start()).rejects.toThrow("already started");
  await expect(ingestion.ingest(event)).rejects.toThrow("ingest failed");
  expect(second.ingest).not.toHaveBeenCalled();
  await ingestion.close();
  await expect(ingestion.ingest(event)).rejects.toThrow("not running");
});

it("creates buffered ingestion using the configured HTTP client", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  const polar = createPolar({
    accessToken: "token",
    organizationId: "org",
    baseUrl: "https://custom.test",
  });
  {
    await using ingestion = await polar.ingestion().start();
    await ingestion.ingest(event);
    expect(fetch).not.toHaveBeenCalled();
  }
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe("https://custom.test/v1/events/ingest");
  const headers = new Headers(request!.headers);
  expect(headers.get("Authorization")).toBe("Bearer token");
  expect(headers.get("Polar-Organization")).toBe("org");
  expect(headers.get("Polar-Version")).toBe("2026-10");
  expect(JSON.parse(request!.body as string)).toEqual({ events: [event] });
});

it("aborts an in-flight HTTP delivery on shutdown", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  let signal: AbortSignal | null | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
    signal = options?.signal;
    return new Promise((_, reject) =>
      signal!.addEventListener("abort", () => reject(signal!.reason), { once: true }),
    );
  });
  const polar = createPolar({ accessToken: "token" });
  const { BufferedIngestionStrategy } = await import("./buffered");
  const onDropped = vi.fn();
  const strategy = await new BufferedIngestionStrategy(polar, {
    shutdownTimeoutMs: 10,
    onDropped,
  }).start();
  await strategy.ingest(event);
  await strategy.close();
  expect(signal?.aborted).toBe(true);
  expect(onDropped).toHaveBeenCalledExactlyOnceWith([event], "shutdown_timeout");
});

it("ships ingestion for both ESM and CommonJS", async () => {
  const esm = await import("../../dist/ingestion/index.mjs");
  const cjs = createRequire(import.meta.url)("../../dist/ingestion/index.cjs");
  expect(esm.Ingestion).toBeTypeOf("function");
  expect(cjs.BufferedIngestionStrategy).toBeTypeOf("function");
});

it("uses buffered ingestion without loading optional Outpost dependencies", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { registerHooks } from "node:module";
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "ioredis" || specifier === "ws") throw new Error("Optional dependency loaded");
      return next(specifier, context);
    }});
    const { createPolar } = await import("@polar-sh/sdk/2026-10");
    await using ingestion = await createPolar({ accessToken: "token" }).ingestion().start();
  `,
    ],
    { encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.status).toBe(0);
});
