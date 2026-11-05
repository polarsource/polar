import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/metering/index.ts",
    "src/outpost/index.ts",
    "src/outpost/cloudflare.ts",
    "src/2026-04/index.ts",
    "src/2026-04/services/**/*.ts",
    "src/2026-10/index.ts",
    "src/2026-10/services/**/*.ts",
    "src/2027-01/index.ts",
    "src/2027-01/services/**/*.ts",
  ],
  format: ["esm", "cjs"],
  // The Workers runtime provides its modules; its types come with the merchant's workers-types.
  external: [/^cloudflare:/, "@cloudflare/workers-types"],
  dts: true,
  sourcemap: true,
  clean: true,
});
