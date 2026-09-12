---
'@polar-sh/checkout': patch
---

Add an `onError` option to `PolarEmbedPaymentMethod.create()` and `createInline()` so merchants can detect init failures (expired/rejected token) that the iframe posts before the `loaded` event. Previously, the `error` message dispatched before `loaded` was silently dropped because the consumer couldn't attach an `error` listener until `await create()` resolved.
