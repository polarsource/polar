import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;
const NODE_ONLY = new Set(["outpost", "redis.ts", join("metering", "outbox", "redis.ts")]);

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
