import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
{% for version in ir.versions %}
    "src/{{ version.version }}/index.ts",
    "src/{{ version.version }}/services/**/*.ts",
{% endfor %}
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
