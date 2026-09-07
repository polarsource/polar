---
'@polar-sh/better-auth': patch
---

Create signup customers after Better Auth inserts the user, including the user ID in the initial Polar request so customer.created webhooks can identify the user. Skip Polar calls when a before-create hook rejects signup, retain one-time linking for existing customers without an external ID, and reject conflicting customer identities without attempting to replace an immutable external ID.
