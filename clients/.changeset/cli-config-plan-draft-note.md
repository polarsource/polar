---
'@polar-sh/cli': patch
---

`polar config plan` now says what it compares against. The Catalog row shows the live catalog (`v3 (live) → v4 (draft)`, or `no live catalog → v1 (draft)`). When an unpublished draft exists, plan says whether it already has the file's changes. It then suggests `polar config publish`, `polar config apply` before publishing, or `polar config apply` to discard a draft the file no longer matches. Webhook changes are reported separately, because apply makes them right away. `--json` adds `live` and `draft`. The draft's `drift` lists the changes the draft is missing. `--pr-comment` notes the draft too.
