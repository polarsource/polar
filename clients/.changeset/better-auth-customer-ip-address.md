---
'@polar-sh/better-auth': minor
---

Send the customer IP address when creating a checkout so Polar can show the visitor's local currency. The IP is resolved with Better Auth's `getIP`, so it follows your `advanced.ipAddress` settings. Use the new `customerIpAddress` option to resolve it yourself, or set it to `false` to stop sending it.
