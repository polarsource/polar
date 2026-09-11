---
'polar-cli': patch
---

Wrap release-check HTTP failures as `GitHubReleaseError` so `describeError` renders them with the `Could not check for updates:` prefix and releases hint, matching the error-wrapping convention the download phase and `listen` command already follow.
