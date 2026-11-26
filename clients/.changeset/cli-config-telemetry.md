---
'@polar-sh/cli': patch
---

`polar config` commands now add a summary of the run to the anonymous usage event: the file format, how many entries the file has and would change, the codes of any issues found and how the run ended. Organization names are no longer included in reported error messages.
