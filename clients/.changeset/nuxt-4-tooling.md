---
'@polar-sh/nuxt': minor
---

Upgrade to Nuxt 4 tooling: `@nuxt/kit` 4, `@nuxt/module-builder` 1, `@nuxt/devtools` 3, `@nuxt/test-utils` 4.3, `vue-tsc` 3 and `zod` 4. The package now ships ESM only (`dist/module.mjs`, types in `dist/types.d.mts`); the CommonJS `require` entry is removed, which Nuxt 3+ does not use.
