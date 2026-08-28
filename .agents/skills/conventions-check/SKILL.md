---
name: conventions-check
description: Check a diff against Polar's written conventions in server/AGENTS.md and clients/AGENTS.md — module structure, repository and service patterns, session types, auth dependencies, test organisation, Orbit Box usage, i18n placement. Use before opening a PR or when the user asks whether a change follows Polar's conventions.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Conventions Check (Polar)

The handle is the **diff**. The evidence is a list of **places it breaks a rule written in
`AGENTS.md`**.

## Rule

`server/AGENTS.md` and `clients/AGENTS.md` are the source of truth. Read them in full before
reviewing. Do not work from memory, and do not invent a rule that is not in those files. If
you want to flag something they do not cover, put it under Question.

## Owned elsewhere

Do not report these; another lens covers them, and duplicate findings are what makes a review
tiring to read.

| Topic | Owner |
|---|---|
| Anything an Accepted ADR covers | `adr-check` |
| Reinventing an existing helper | `reuse-check` |
| Agent-generated noise, redundant tests | `slop-check` |
| API contract, schemas, SDK impact | `api-surface-review` |
| Migrations, tasks, deploy ordering | `ship-safety` |
| Billing domain behaviour | `billing-review` |

What is left for you: module structure, the repository and service patterns, read versus
write sessions, auth dependencies and per-module `auth.py`, test layout and fixtures, Orbit
`<Box />` usage, the 250-line frontend file limit, i18n placement.

## Output

```
## Conventions

### 🔴 Blocking
- `file:line` — <claim>. Fix: <fix>

### 🟠 Should fix
- `file:line` — <claim>. Fix: <fix>

### 🟡 Question
- `file:line` — <question>

### Verdict
✅ Clean  |  ❌ n blocking, n should-fix
```

Quote the rule from `AGENTS.md` in the claim. High-confidence findings only. Never flag
unchanged code.
