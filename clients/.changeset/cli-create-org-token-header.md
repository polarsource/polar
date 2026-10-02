---
'@polar-sh/cli': patch
---

Fix `create` commands failing with organization access tokens when `--org` is passed. The CLI sent `organization_id` in the request body, which organization tokens reject; it now sends the organization only in the `Polar-Organization` header.
