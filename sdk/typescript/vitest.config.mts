import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

// `vitest run` keeps its defaults; `vitest bench` picks up the `*.bench.ts` files and, in CI,
// reports to CodSpeed.
export default defineConfig({
  plugins: [codspeedPlugin()],
});
