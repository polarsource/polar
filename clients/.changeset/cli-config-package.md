---
'@polar-sh/cli': patch
---

`polar config init` installs `@polar-sh/config` instead of `@polar-sh/polar`, and generated TypeScript configs import `defineConfig` and its helpers from `@polar-sh/config`.
