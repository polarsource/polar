---
'@polar-sh/cli': patch
---

`polar agent setup` now checks the Polar skills in `.agents/skills` and `~/.agents/skills` before asking what to set up, and preselects any that are out of date, so running it again updates them.
