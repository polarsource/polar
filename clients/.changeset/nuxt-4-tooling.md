---
'@polar-sh/nuxt': minor
---

Target Nuxt 4, now that Nuxt 3 reached end-of-life on July 31, 2026. Upgrades `@nuxt/kit` to 4, `@nuxt/module-builder` to 1, `@nuxt/devtools` to 3, `@nuxt/test-utils` to 4.3, `vue-tsc` to 3 and `zod` to 4. The package now ships ESM only (`dist/module.mjs`, types in `dist/types.d.mts`); the CommonJS `require` entry, which Nuxt does not use, is removed. `zod` is now a runtime dependency, so apps no longer need to install it themselves.
