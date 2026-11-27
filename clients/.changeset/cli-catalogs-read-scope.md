---
'@polar-sh/cli': patch
---

`polar auth login` now also asks for the `catalogs:read` scope, which reading catalogs needs. If `polar config publish` fails with a missing `catalogs:read` scope, run `polar auth login` again.
