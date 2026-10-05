---
'@polar-sh/better-auth': minor
---

Forward the customer IP address when creating a checkout so Polar can show the visitor's local currency. The IP is resolved with Better Auth's `getIP`, so it follows your `advanced.ipAddress` settings (`ipAddressHeaders`, `trustedProxies`, `disableIpTracking`). A missing or invalid IP is not sent. Use the new `customerIpAddress` checkout option to supply your own resolver, or set it to `false` to stop sending the IP.
