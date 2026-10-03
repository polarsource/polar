---
'@polar-sh/checkout': patch
---

Fix the embedded checkout showing a solid dark box instead of a transparent overlay when the Checkout Link already carries `?theme=dark` and no `theme` option is passed. The iframe now takes its color scheme, and the loader its colors, from the theme on the final checkout URL, the same value the embedded page uses.
