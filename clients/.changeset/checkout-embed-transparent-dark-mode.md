---
'@polar-sh/checkout': patch
---

Fix embedded checkout and payment method iframes painting an opaque white background on host pages that declare a dark color scheme (`<meta name="color-scheme" content="light dark">` or `dark`) when the OS is in dark mode. The iframe element now uses `color-scheme: light`, matching the embedded document, so the browser keeps the frame transparent.
