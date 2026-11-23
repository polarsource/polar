---
'@polar-sh/better-auth': major
---

We're recommending using the new server API for usage ingestion and removing the `ingest` method on the client API. Replace `authClient.usage.ingest(...)` with `auth.api.ingestUsage({ headers, body })` in your server code.
