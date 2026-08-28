---
name: yeet
description: Lint, type-check, review, run cubic, then open a draft pull request. This is the only sanctioned way to open a PR in this repo. Use when the user asks to yeet, open, create, draft, or ship a pull request.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Yeet (Polar)

Take a branch from "the code is written" to "a draft PR a human can review".

**This is the only way to open a pull request in this repo.** Do not create a PR from
any other workflow — not `gh pr create`, not a PR tool, not at the end of an unrelated
task. If the user has not asked for a PR in this conversation, stop after pushing the
branch and tell them the branch name.

## Scope

Run every step. Skip a step only when the condition attached to it says so — never to
save time. If a step cannot run in this environment (a tool is missing, a review command
does not exist), say so explicitly in your summary rather than silently dropping it.

## 1. Get the diff

```bash
git diff --name-only main...HEAD
```

Everything below keys off which areas changed.

## 2. Lint and type-check

Run the applicable steps in parallel.

If any file under `server/` changed:

```bash
cd server && uv run task lint
cd server && uv run task lint_types
```

If any file under `clients/` changed:

```bash
cd clients && pnpm lint
```

If a step fails, fix it and re-run only that step until it passes. If lint auto-fixed
files (ruff formatting, oxfmt), stage and commit them separately, e.g.
`lint: auto-fix formatting`.

## 3. Review

Run the reviews available in your environment, in this order. Fix real issues, commit the
fixes, then re-run the affected review.

**Always available** — repo skills, pick the ones the diff actually touches:

- `conventions-check` — Polar conventions in `server/AGENTS.md` / `clients/AGENTS.md`
- `adr-check` — Accepted ADRs in `handbook/engineering/decisions/`
- `reuse-check` — code that reinvents an existing helper
- `ship-safety` — schema changes unsafe against the running deploy
- `slop-check` — agent-generated noise in the diff
- `api-surface-review` / `billing-review` — if the diff touches the API contract or billing

**If available in this environment** (Claude Code built-ins; they do not exist in Cursor):

- `/code-review xhigh --fix`
- `/simplify`
- `/security-review`
- `/polar-code-review`

## 4. cubic

The working tree should be clean by now, so cubic reviews the branch against its base:

```bash
cubic review -b -j
```

If `cubic` is not installed, skip this step and say so. Do not install it silently.

Present issues grouped by priority, highlighting P0 and P1. Fix real P0 and P1 issues;
skip false positives with a one-line reason. **Do not open the PR while an unfixed, real
P0 or P1 remains.**

## 5. Open the PR as a draft

Use whatever PR mechanism the environment provides — `gh pr create --draft` locally, or
the built-in PR tool in Cloud. It must be a **draft** either way.

Never reopen a closed PR, and never open a second PR for a branch that already has one.
If the branch already has a PR, update that PR instead — and leave the title and body
alone if a human has edited them.

### Title

Use a conventional commit prefix: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`,
`test:`, `perf:`, `ci:`, `build:`, `style:`. We use merge queues with squash, so the PR
title becomes the final commit message on `main`.

```
feat: add webhook retry with exponential backoff
fix: prevent duplicate subscription charges
refactor: extract payment validation into service layer
```

### Description

Build it from `.github/pull_request_template.md`. Keep that file's section headers.
Derive the content from the full commit history since `main`, not just the last commit.

- Include only sections that carry real information. A small fix may need just
  `## Summary`; a feature may need `## Summary`, `## What`, and `## Why`.
- Always keep `## Checklist`. Tick only what you actually verified in this run. Leave
  tests unticked if you did not add any.
- Omit `Related Issue: #<n>` unless an issue is genuinely referenced by the branch or
  commits.

Write it for readers who are not native English speakers: short sentences, one idea each,
common words, bullets over paragraphs. A reviewer should finish the body in under a
minute.

### This is a public repo

- **No PII** — no names, emails, user IDs, API keys, tokens, internal URLs, or customer
  data, even if they appear in commit messages or the diff.
- **No business data** — no revenue figures, user counts, conversion rates, or other
  internal metrics.

Describe what changed and why, without exposing sensitive details.
