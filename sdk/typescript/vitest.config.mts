import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

// `vitest run` keeps its defaults; `vitest bench` picks up the `*.bench.ts` files and, in CI,
// reports to CodSpeed. The Cloudflare tests run in Miniflare: see vitest.workers.config.mts.
export default defineConfig({
  plugins: [codspeedPlugin()],
  test: { exclude: ["**/node_modules/**", "**/*.workers.test.ts"] },
});
