---
'@polar-sh/cli': minor
---

Add `polar auth token` to create an organization access token through the dashboard. Add `--json` to every command and `--fields` to trim API command output; `--json` stays plain when piped, and destructive API commands ask for confirmation, or `--confirm` without a terminal. Move `polar listen` and `polar trigger` to `polar webhook listen` and `polar webhook trigger`. Add `events ingest`, `events list`, `subscriptions create`, `checkouts create`, `customer_sessions create`, `disputes list` and `disputes get`.
