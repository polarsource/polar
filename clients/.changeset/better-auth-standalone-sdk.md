---
'@polar-sh/better-auth': major
---

Migrate to the new Polar SDK (`@polar-sh/sdk/2026-04`) and use standalone SDK functions so application bundles include only the API operations used by the adapter.

Create the `client` option with `createPolarCore` instead of `createPolar`, importing it from `@polar-sh/sdk/2026-04`. Custom plugins passed through `use` now receive a `PolarCore` and must use standalone SDK functions with it.
