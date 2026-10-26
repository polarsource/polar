---
'@polar-sh/cli': patch
---

`polar config plan` and `polar config apply` load `polar.config.ts` with the installed binary. Before, it failed to resolve packages like `@polar-sh/polar` and said they were not installed.
