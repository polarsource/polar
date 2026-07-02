---
name: adr-check
description: Check a code change against the repo's Accepted Architecture Decision Records (ADRs) in handbook/engineering/decisions/ and report violations with citations. Use before opening a PR, when reviewing a diff, or when the user asks to check ADR compliance, whether changes follow the architecture decisions, or to verify a change against the ADRs.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# ADR Compliance Checker (Polar)

The handle is the **diff**. The evidence is a short report of **which Accepted ADRs
the change touches and where it breaks them**. This is the ADR analogue of
[`verifier-web`](../verifier-web/SKILL.md): that skill replays UI changes, this one
reviews a change against the recorded architecture decisions.

ADRs live in `handbook/engineering/decisions/`. Treat every ADR whose Status is
**Accepted** as binding.

## When to use

- Before opening a PR, or while reviewing one.
- When the user asks to "check the ADRs", "does this follow our decisions", or
  "verify against the architecture decisions".
- As one dimension of a broader review, alongside `/polar-code-review`.

## How to run

### 1. Get the change

Prefer the branch diff; fall back to the working tree.

```bash
git diff --name-only main...HEAD    # committed on this branch
git diff --name-only                # unstaged
git diff --name-only --staged       # staged
```

Then read the actual hunks for the changed files (`git diff main...HEAD -- <file>`).

### 2. Load the ADRs (dynamically, never hardcode the list)

```bash
ls handbook/engineering/decisions/[0-9]*.mdx
```

Read each one. For every ADR with **Status: Accepted**, extract its **Decision**
(the rule) and its **Area** (Backend, Frontend, Infra, or Cross-cutting). Apply an
ADR only to files in its Area: a frontend ADR does not apply to `server/`, and vice
versa. Reading the ADRs each run keeps the check current as ADRs are added or
superseded.

### 3. Check each relevant ADR against the diff

Read the ADR's Decision and Consequences, then look for the violation signature in
the changed hunks. For the ADRs that exist today:

- **ADR-0002 (status-coded `PolarError`)**: a `PolarError` subclass or a `raise`
  with no explicit `status_code` (it defaults to 500); a business or logic error
  raised as `PolarRequestValidationError` (422); an endpoint that declares an error
  but omits it from `responses=`; a content-less `422: {"description": ...}`
  override. Area: Backend.
- **ADR-0003 (one transaction per request or task)**: any `session.commit()` in
  application code (services, endpoints, tasks). Grep the diff for `.commit(`.
  Area: Backend.
- **ADR-0004 (Orbit `Box` + tokens)**: new UI using a raw `<div>` plus Tailwind for
  layout, spacing, or color; `dark:` variants; raw hex or px values; or `className`
  / `style` on `<Box />` or `<Text />`. Most of this is caught by ESLint
  (`no-classname-box`, `no-view`, `no-hardcoded-colors`, and friends); the value you
  add is flagging new component files that avoid `Box` entirely. Area: Frontend.
- **ADR-0005 (`AuthSubject` + scopes)**: a new endpoint with no `auth_subject`
  dependency that is not meant to be public; a hand-rolled `AuthSubject`; an endpoint
  that bypasses its module's `Authenticator`. Area: Backend.
- **ADR-0006 (migration + backfill safety)**: a migration under
  `server/migrations/versions/` with an unbatched `UPDATE`; adding a NOT NULL column
  in one step instead of add-nullable, then batched backfill, then enforce; a
  migration PR that also touches non-migration application code. Area: Backend.

ADR-0001 is the meta record and has no code rule. For any ADR not in this list,
derive its violation signature from its own Decision and Consequences the same way.

### 4. Report

Keep it short and scannable:

- **Violations**, most severe first. For each: the ADR id and title, the
  `file:line`, one line on what breaks the rule, and the fix.
- **Uncovered decisions**: if the change makes a significant, cross-cutting, or
  hard-to-reverse decision that no ADR covers, say so and offer to draft one from
  `handbook/engineering/decisions/template.mdx`.
- If nothing conflicts and nothing new is ADR-worthy, say so in one line, and list
  which ADRs you checked and which were not applicable to this diff.

This skill reviews and reports. It does not edit code; fixes are a follow-up.
