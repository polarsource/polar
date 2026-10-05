---
'@polar-sh/adapter-utils': minor
'@polar-sh/nextjs': minor
'@polar-sh/nuxt': minor
'@polar-sh/tanstack-start': minor
---

Forward the customer IP address when creating a checkout so Polar can show the visitor's local currency. When the `customer_ip_address` query param is not passed, the checkout route uses the first valid IP from the `x-forwarded-for`, `x-real-ip` and `cf-connecting-ip` headers. A missing or invalid IP is not sent. Use the new `customerIpAddress` option to supply your own resolver, or set it to `false` to stop sending the IP.
