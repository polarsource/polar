---
'@polar-sh/cli': patch
---

Coding agents such as Claude Code, Cursor and Codex are detected and treated like a non-interactive terminal: no prompts and no spinners, even when they attach a pseudo-terminal. The new global `--non-interactive` flag forces the same behaviour anywhere.
