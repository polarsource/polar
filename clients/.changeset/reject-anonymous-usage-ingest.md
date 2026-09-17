---
'@polar-sh/better-auth': patch
---

Reject anonymous sessions from `/usage/ingest` before forwarding the session id as a Polar `externalCustomerId`. Without this guard, an anonymous better-auth session (which carries both `user.id` and `isAnonymous === true`) passed the existing `user.id` check and forwarded its anonymous id to `polar.events.ingest`, inserting orphan `meter_event` rows that inflate merchant org-wide meter totals under the README-default Organization Access Token. Mirrors the guard already applied to the sibling `/customer/portal` handler.
