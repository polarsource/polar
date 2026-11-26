---
'@polar-sh/config': patch
'@polar-sh/cli': patch
---

Add `settings.subscriptions` to the config: `allowMultipleSubscriptions`, `prorationBehavior`, `benefitRevocationGracePeriod` and `preventTrialAbuse`. `benefitRevocationGracePeriod` takes the dashboard's options, like `'immediately'` or `'7 days'`. `polar config init` and `polar config reset` could not write a TypeScript config for an organization that has these settings.
