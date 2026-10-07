---
'@polar-sh/checkout': patch
---

Fix browser builds that import `@polar-sh/checkout/components`, hooks, providers, or guards. 0.4.3 shipped a `node:module` helper in those entries, which esbuild and webpack cannot resolve and which throws in the browser under Vite.
