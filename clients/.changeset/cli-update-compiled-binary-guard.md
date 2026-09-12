---
'polar-cli': patch
---

Guard `polar update` with `isCompiledBinary()` so it refuses to run from source (`bun src/cli.ts update`), preventing it from overwriting the user's Bun runtime. Also guard `showUpdateNotice` and `checkForUpdateInBackground` so the update notice is not shown to developers running from source.
