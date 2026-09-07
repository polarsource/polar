---
"@polar-sh/better-auth": patch
---

Surface HTTP status in `checkoutEmbed` errors when the response body is empty or non-JSON, instead of throwing an `Error` with an empty message.
