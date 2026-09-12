---
'@polar-sh/checkout': patch
---

Fix stuck submit button spinner when `stripe.handleNextAction` rejects during 3DS/SCA confirmation. The `requires_action` loop is now wrapped in `try`/`finally` so `loading` is always reset, mirroring every other throw site in `confirm`.
