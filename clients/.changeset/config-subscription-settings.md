---
'@polar-sh/config': patch
'@polar-sh/cli': patch
---

Add `settings.subscriptions` to the config: `allow_multiple_subscriptions`, `proration_behavior`, `benefit_revocation_grace_period` and `prevent_trial_abuse`. `polar config init` and `polar config reset` could not write a TypeScript config for an organization that has these settings.
