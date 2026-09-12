---
'@polar-sh/better-auth': patch
---

Reject anonymous sessions from `/usage/meters/list` before forwarding the session id as a Polar `externalCustomerId`. Without this guard, an anonymous better-auth session (which carries both `user.id` and `isAnonymous === true`) passed the existing `user.id` check and reached `createCustomerSessions` with the throwaway anonymous id as `external_customer_id`, which the Polar backend rejects with `422` ("Customer does not exist.") since the adapter never creates a Customer for anonymous users. The handler's catch block then converted this into a misleading `500 INTERNAL_SERVER_ERROR` ("Meters list failed"). Anonymous sessions are now rejected with a clear `401 UNAUTHORIZED`, avoiding the unnecessary backend round-trip. Mirrors the guard already applied to the sibling `/usage/ingest` and `/customer/portal` handlers.
