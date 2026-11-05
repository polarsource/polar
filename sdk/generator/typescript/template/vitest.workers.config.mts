import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The Durable Objects run in Miniflare; Polar is mocked with `fetchMock` from `cloudflare:test`.
export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/outpost/cloudflare.ts",
      miniflare: {
        compatibilityDate: "2026-10-01",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          OUTPOST_CUSTOMER: "CustomerDO",
          OUTPOST_SYNC: "SyncDO",
        },
        bindings: {
          POLAR_ACCESS_TOKEN: "test-token",
          POLAR_BASE_URL: "https://polar.test",
        },
      },
    }),
  ],
  test: { include: ["src/outpost/*.workers.test.ts"] },
});
