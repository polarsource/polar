---
'@polar-sh/cli': patch
---

Require confirmation when resetting a webhook endpoint secret with the CLI, since the current secret stops working immediately and deliveries fail verification until the receiver switches to the new one.
