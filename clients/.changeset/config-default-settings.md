---
'@polar-sh/config': patch
'@polar-sh/cli': patch
---

A setting left out of `settings` is now set to its default, the value a new organization gets, instead of keeping its current value. `polar config init` and `polar config reset` only write settings that differ from their default, and write an empty `settings` when none do, so apply still resets every setting to its default.
