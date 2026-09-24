---
'@polar-sh/better-auth': minor
---

Support Better Auth 1.7. The `better-auth` peer dependency is now `^1.7.0`.

Better Auth 1.7 no longer types a top-level `query` on client calls to endpoints that also accept a body. To open the portal for an organization, pass the query through `fetchOptions`: `authClient.customer.portal({ fetchOptions: { query: { organizationId } } })`.
