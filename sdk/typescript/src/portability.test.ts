import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;
const NODE_ONLY = new Set(["outpost"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return NODE_ONLY.has(entry.name) ? [] : sourceFiles(path);
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
