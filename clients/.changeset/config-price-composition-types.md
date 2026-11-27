---
'@polar-sh/config': patch
---

`.prices()` now rejects at type level a second fixed or free price, a second seat-based or unit-based price, and a meter charged by more than one price.
