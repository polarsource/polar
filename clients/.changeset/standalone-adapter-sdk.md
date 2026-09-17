---
'@polar-sh/better-auth': major
'@polar-sh/nextjs': patch
'@polar-sh/nuxt': patch
'@polar-sh/tanstack-start': patch
---

Use standalone SDK functions so application bundles include only the API operations used by each adapter.

For Better Auth, create the `client` option with `createPolarCore` instead of `createPolar`, importing it from `@polar-sh/sdk/2026-04`. Custom plugins passed through `use` now receive a `PolarCore` and must use standalone SDK functions with it.
