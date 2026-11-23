---
'@polar-sh/better-auth': minor
---

Usage ingestion is now server-only. The `authClient.usage.ingest()` client method and the `/usage/ingest` HTTP endpoint are removed because any signed-in user could call them with arbitrary usage. Call `auth.api.ingestUsage({ headers, body })` from the server code that performs the metered work instead.
