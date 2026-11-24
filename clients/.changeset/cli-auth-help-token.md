---
'@polar-sh/cli': patch
---

Document token authentication in the help. `polar --help` and `polar auth --help` list `POLAR_ACCESS_TOKEN` and `POLAR_ENVIRONMENT` in a new ENVIRONMENT section, `polar auth token` explains that it gives your app its own organization access token approved by a human in the browser, and "Not logged in" messages mention setting `POLAR_ACCESS_TOKEN`.
