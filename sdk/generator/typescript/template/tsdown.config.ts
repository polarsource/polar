import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/metering/index.ts",
    "src/outpost/index.ts",
    "src/outpost/cloudflare.ts",
{% for version in ir.versions %}
    "src/{{ version.version }}/index.ts",
    "src/{{ version.version }}/services/**/*.ts",
{% endfor %}
  ],
  format: ["esm", "cjs"],
  // The Workers runtime provides its modules; its types come with the merchant's workers-types.
  external: [/^cloudflare:/, "@cloudflare/workers-types"],
  dts: true,
  sourcemap: true,
  clean: true,
});
