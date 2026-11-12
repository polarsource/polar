---
"@polar-sh/better-auth": patch
---

Reject anonymous sessions from the usage meters and customer portal endpoints before calling Polar. Listing subscriptions by `reference_id` now returns every matching subscription only to members of that Better Auth organization; other users only see their own.
