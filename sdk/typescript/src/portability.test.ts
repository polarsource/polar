import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;
const NODE_ONLY = new Set(["outpost", "redis.ts", join("metering", "queue", "redis.ts")]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (NODE_ONLY.has(relative(SRC, path))) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !/\.(test|bench)\.ts$/.test(entry.name) ? [path] : [];
  });
}

describe("runtime portability", () => {
  it("keeps node: imports out of entries bundled for browsers and edge runtimes", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /from\s+["']node:/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

it("ships metering for both ESM and CommonJS", async () => {
  const esm = await import("../dist/metering/index.mjs");
  const cjs = createRequire(import.meta.url)("../dist/metering/index.cjs");
  expect(esm.MemoryEventQueue).toBeTypeOf("function");
  expect(cjs.MemoryEventQueue).toBeTypeOf("function");
});

it("uses the memory queue without loading optional Outpost dependencies", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { registerHooks } from "node:module";
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "ioredis" || specifier === "ws" || specifier.startsWith("@opentelemetry/")) {
        throw new Error("Optional dependency loaded: " + specifier);
      }
      return next(specifier, context);
    }});
    const { createPolar } = await import("@polar-sh/sdk/2026-10");
    const polar = createPolar({ accessToken: "token" });
    globalThis.fetch = async () => new Response('{"inserted":1,"duplicates":0}');
    const actor = polar.actor({ external_customer_id: "alice" });
    await actor.track({ name: "usage" });
    await polar.close();
  `,
    ],
    { encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.status).toBe(0);
});
