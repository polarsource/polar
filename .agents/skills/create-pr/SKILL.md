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

## 1. Prepare the branch

```bash
git status --short
git diff --name-only main...HEAD
git diff --name-only
git diff --cached --name-only
```

Use the union of these outputs to decide which checks apply. `main...HEAD` does not include
unstaged or untracked files.

Inspect every staged, unstaged, and untracked file before committing. Exclude unrelated
files and anything that may contain secrets. Commit the intended changes, then require a
clean working tree before review.

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
cd clients && pnpm typecheck
```

If a step fails, fix it and re-run only that step until it passes. If lint auto-fixed
files (ruff formatting, oxfmt), stage and commit them separately, e.g.
`lint: auto-fix formatting`.

Commit check fixes before review and confirm `git status --short` is empty.

## 3. Review

If the environment also provides `/code-review xhigh --fix`, `/simplify`, or
`/security-review`, run them before the Polar code review. They complement the
Polar-specific review but do not replace it.

Always run the Polar code review. Read `.agents/commands/polar-code-review.md` and follow
it exactly.

Fix real findings, commit the fixes, then re-run only the lenses that raised them. Do not
continue while a real blocking or should-fix finding remains. Questions do not block PR
creation.

## 4. cubic

```bash
cubic review --base main --json
```

`--base` requires a value. Never abbreviate this as `cubic review -b -j`; that treats `-j`
as the base branch.

Set the command execution timeout to 10 minutes. If it produces no output, terminate it
and retry once with the same timeout plus `--print-logs --log-level INFO`. If the logs
show repeated HTTP 5xx responses, terminate the retry immediately: the API is unavailable.
Record the skipped review in the final handoff. Do not install cubic or change its
authentication.

Present issues grouped by priority, highlighting P0 and P1. Fix real P0 and P1 issues;
skip false positives with a one-line reason. **Do not open the PR while an unfixed, real
P0 or P1 remains.**

## 5. Open the PR as a draft

Before pushing or creating anything, check for open and closed PRs from the current branch.

- If an open PR exists, push the branch, report that PR, and stop this workflow. Do not
  create another one, change its draft state, or modify its title or body.
- If a closed PR exists, do not reopen it or create another one. Stop and ask the user.
- Otherwise, push the branch and create a **draft** PR using the available PR mechanism.

Verify the resulting PR targets `main` and is a draft. Never mark it ready for review.
The Title and Description instructions below apply only when creating a new PR.

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
