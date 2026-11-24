---
'@polar-sh/cli': patch
---

`polar config plan` now says what it compares against. The Catalog row shows the live catalog (`v3 (live) → v4 (draft)`, or `no live catalog → v1 (draft)`). When an unpublished draft exists, plan says whether a previous apply already saved these changes in it and suggests `polar config publish`. Otherwise it suggests `polar config apply` before publishing. `--json` adds `live` and `draft` (with the `drift` still missing from the draft), and `--pr-comment` notes the draft too.
