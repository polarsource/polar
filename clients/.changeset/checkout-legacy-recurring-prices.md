---
'@polar-sh/checkout': minor
---

Remove legacy recurring price support. `isLegacyRecurringProductPrice` is gone from `@polar-sh/checkout/guards`: every product now carries its own `recurring_interval`, and the product switcher shows one option per product.
