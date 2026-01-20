---
"@polar-sh/checkout": patch
---

Fix event handler accumulation when creating multiple EmbedCheckout instances by properly removing window message listeners on close
