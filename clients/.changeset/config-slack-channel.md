---
'@polar-sh/cli': patch
---

`polar config init` now works for organizations with a Slack shared channel benefit. The benefit is written to the config with the new `slackChannel()` helper and can be created and removed from it. Changing an existing one is refused for now, so customers keep their channels.
