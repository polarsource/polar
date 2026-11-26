---
'@polar-sh/better-auth': major
---

We're removing the `usage` plugin. Customer meters are now listed by the `portal` plugin with `authClient.customer.meters.list()`, which replaces `authClient.usage.meters.list()`. The `ingest` method on the client API is removed: ingest usage events from your server with the Polar SDK instead. Remove `usage()` from the `use` array of `polar()`, and add `portal()` if it is not already there.
