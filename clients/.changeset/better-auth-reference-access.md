---
'@polar-sh/better-auth': minor
---

`customer.subscriptions.list({ query: { reference_id } })` no longer returns customer billing details to every signed-in user. Owners and admins of the Better Auth organization, and the user who purchased a subscription, still get the full subscription. Other members get the subscription without the `customer`, `discount`, `custom_field_data` and cancellation reason fields, and with `metadata` reduced to `referenceId`, so entitlement checks on `product_id` or `status` keep working. A user with no relation to the organization or user behind a `reference_id` only gets the subscriptions they purchased.

Add the `authorizeReference` option to `polar()` to authorize reference IDs that are not Better Auth organizations, such as workspaces from your own tables. Without it, those IDs keep returning subscriptions without billing details and log a warning; the next major version will only return the subscriptions the user purchased.
