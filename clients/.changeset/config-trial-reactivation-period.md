---
'@polar-sh/config': patch
---

Add `trialEndedReactivationPeriod` to `settings.subscriptions`: how long a customer can add a payment method after a trial ends without one, before the subscription is canceled. It takes the same options as `benefitRevocationGracePeriod`, like `'14 days'`, and defaults to 14 days.
