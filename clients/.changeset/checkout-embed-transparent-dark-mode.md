---
'@polar-sh/checkout': patch
---

Fix the embedded checkout and payment method showing a solid white or black box instead of a transparent overlay on some host pages.

Browsers only draw an iframe transparent when the iframe element and the page inside it use the same `color-scheme`. The SDK set `color-scheme: normal` on the iframe, which takes the host page's `<meta name="color-scheme">`, so the result depended on the host: a host declaring `dark` broke in every OS mode, and one declaring `light dark` broke whenever the OS was in dark mode.

The iframe now uses the embed's `theme` — `color-scheme: dark` for `theme: 'dark'`, `color-scheme: light` otherwise — and the embedded page declares the same value, so the overlay stays transparent on every host page. Browser-drawn parts such as scrollbars and autofill now follow the theme too.

**Upgrade required for `theme: 'dark'`.** Older SDK versions don't set a matching color scheme, so with the dark theme they show a solid dark box on host pages without a color-scheme meta tag. Update `@polar-sh/checkout` to fix it; the embed script loaded from jsDelivr with `@latest` picks up the fix on its own.
