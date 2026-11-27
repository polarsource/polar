---
'@polar-sh/cli': patch
---

`polar auth login` now asks for the `catalog:publish` scope, which `polar config publish` needs. If publishing fails with a missing scope, run `polar auth login` again. In CI, give the organization access token the `catalog:publish` scope alongside the scopes your config already needs, for example with `polar auth token --scope catalog:publish --scope products:write`.
