---
name: create-pr
description: Lint, type-check, review, run cubic, then open a draft pull request. This is the only sanctioned way to open a PR in this repo. Use when the user asks to create, open, draft, ship, or yeet a pull request.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Create PR (Polar)

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

Always run the Polar code review. Read `.agents/commands/polar-code-review.md` and follow
it exactly. The file is tracked in the repo, so this review is available in every agent
environment even when `/polar-code-review` is not registered as a slash command.

Fix real issues, commit the fixes, then run the review again.

If the environment also provides `/code-review xhigh --fix`, `/simplify`, or
`/security-review`, run them before the Polar code review. They complement the
Polar-specific review but do not replace it.

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

Do not write the PR description. The human writes it. Paste this empty template as the
body and stop. Do not fill any section, tick any box, or add extra text.

```markdown
## Summary

This is human communication. Do not be lazy.

**Related Issue**: #

## What

## Why

## How

## Checklist

- [ ] This PR addresses a single concern (one bug fix, one feature, one refactor)
- [ ] The diff is reasonably sized and easy to review
- [ ] New functionality is covered by tests
- [ ] Linting and type checking pass (`uv run task lint && uv run task lint_types`)
- [ ] No unrelated changes or drive-by fixes are included
```
