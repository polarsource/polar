# @polar-sh/config

## 0.0.2

### Patch Changes

- 86532ac: A setting left out of `settings` is now set to its default, the value a new organization gets, instead of keeping its current value. `polar config init` and `polar config reset` only write settings that differ from their default, and write an empty `settings` when none do, so apply still resets every setting to its default.
- c295c57: `.prices()` now rejects at type level a second fixed or free price, a second seat-based or unit-based price, and a meter charged by more than one price.
- cd680ef: Add `settings.subscriptions` to the config: `allowMultipleSubscriptions`, `prorationBehavior`, `benefitRevocationGracePeriod` and `preventTrialAbuse`. `benefitRevocationGracePeriod` takes the dashboard's options, like `'immediately'` or `'7 days'`. `polar config init` and `polar config reset` could not write a TypeScript config for an organization that has these settings.

## 0.0.1

### Patch Changes

- 24419ff: First release of `@polar-sh/config`: define your Polar products, meters and benefits as code with `defineConfig`.
