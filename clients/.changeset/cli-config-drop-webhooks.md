---
'@polar-sh/cli': patch
---

`polar config` no longer handles a `webhooks` section, and no longer asks for the `webhooks` scopes when a config declares one. Webhook endpoints are managed from the dashboard or the API.
