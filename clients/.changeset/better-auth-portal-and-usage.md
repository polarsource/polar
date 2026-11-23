---
'@polar-sh/better-auth': patch
---

Listing subscriptions by `reference_id` now requires a Better Auth organization ID and a billing role. Client usage ingestion requires explicitly listing permitted event names in `usage({ clientEvents: [...] })`. Record billable events on the server.
