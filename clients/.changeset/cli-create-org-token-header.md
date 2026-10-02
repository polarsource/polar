---
'@polar-sh/cli': patch
---

Fix `create` commands failing with "Setting organization_id is disallowed when using an organization token" when `POLAR_ACCESS_TOKEN` is an organization access token and you pass `--org` or `organization_id` in `--data`. The organization is now sent only through the `Polar-Organization` header, never in the request body.
