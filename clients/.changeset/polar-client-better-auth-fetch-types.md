---
'@polar-sh/better-auth': patch
---

`polarClient()` is assignable to `BetterAuthClientPlugin` on better-auth 1.7, including 1.7.14, so `createAuthClient` and `inferAdditionalFields` keep their types. `checkoutEmbed` stays typed.
