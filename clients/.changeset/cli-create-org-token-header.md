---
'@polar-sh/cli': patch
---

Fix `create` commands failing for organization access tokens when an organization is passed explicitly.

**Problem.** With an organization access token in `POLAR_ACCESS_TOKEN`, `create` commands (`customers`, `products`, `benefits`, `discounts`, `meters`, `custom_fields`) and `webhooks create_webhook_endpoint` returned `organization_id: Setting organization_id is disallowed when using an organization token.` when you passed `--org` or set `organization_id` in `--data`. The CLI was sending the organization in the request body, which the API rejects for organization tokens.

**Fix.** The CLI now sends the organization only in the `Polar-Organization` header, so these commands succeed. `--org` behaves the same as before for `polar auth login` sessions and personal access tokens.
