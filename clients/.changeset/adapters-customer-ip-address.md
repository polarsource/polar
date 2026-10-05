---
'@polar-sh/adapter-utils': minor
'@polar-sh/nextjs': minor
'@polar-sh/nuxt': minor
'@polar-sh/tanstack-start': minor
---

Send the customer IP address when creating a checkout so Polar can show the visitor's local currency. When the `customer_ip_address` query param is not passed, the checkout route uses the first valid IP from the `x-forwarded-for`, `x-real-ip` and `cf-connecting-ip` headers.
