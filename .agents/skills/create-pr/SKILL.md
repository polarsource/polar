---
name: create-pr
description: Lint, type-check, review, run cubic, then open a draft pull request. This is the only sanctioned way to open a PR in this repo. Use when the user asks to create, open, draft, ship, or yeet a pull request.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Create PR (Polar)

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
it exactly.

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

Do not write the PR description. The human writes it.

Build the body from `.github/pull_request_template.md`: keep every section header and the
checklist verbatim, drop the HTML comment placeholders, and leave each section empty.
Under `## Summary`, put exactly one line:

```
This is human communication. Do not be lazy.
```

Do not fill any other section, tick any box, or add extra text.
