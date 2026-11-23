---
'@polar-sh/better-auth': minor
---

`customer.subscriptions.list({ query: { reference_id } })` now tailors the response to the signed-in user's relationship with the `reference_id`. Owners and admins of the Better Auth organization, and the user who purchased a subscription, get the full subscription. Other members get the fields needed for entitlement checks, such as `product_id` and `status`, without `customer`, `discount`, `custom_field_data` or the cancellation reason, and with `metadata` limited to `referenceId`. Users with no relation to the organization or user behind a `reference_id` get the subscriptions they purchased.

Add the new `authorizeReference` option to `polar()` to control access for reference IDs that are not Better Auth organizations, such as workspaces from your own tables. Without it, those IDs return subscriptions without billing details and log a warning; the next major version will only return the subscriptions the user purchased.
