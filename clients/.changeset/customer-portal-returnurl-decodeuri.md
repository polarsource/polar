---
'@polar-sh/nextjs': patch
'@polar-sh/nuxt': patch
'@polar-sh/tanstack-start': patch
'@polar-sh/better-auth': patch
---

Fix customer-portal `returnUrl` percent-escape corruption. The customer-portal route handlers previously wrapped the merchant-configured `returnUrl` in `decodeURI(new URL(returnUrl).toString())`, which stripped one layer of percent-encoding and corrupted any URL containing a literal `%` (encoded as `%25`) or a double-encoded value. The canonical URL produced by `new URL(returnUrl).toString()` is now passed through verbatim.
