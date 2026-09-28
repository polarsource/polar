---
name: open-pr
description: Open or update a draft GitHub pull request after Polar-specific review and cubic CLI review. Use only when the user invokes open-pr, /open-pr, or $open-pr by name. Do not use for a plain request to open a PR, or for a host Create PR button.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Open PR

Open or update a **draft** pull request. Do not mark it ready for review.

This is not a bug hunt and not a security review. `/code-review`, `/security-review`,
and `/simplify` do those. Do not run Cursor `/review` here.

Address every review comment by default (Polar, cubic CLI, cubic GitHub, humans).
Fix, commit, push, rerun that step. Dispute only when the comment is factually wrong.

## 1. Preconditions

- Working tree committed. Branch pushed. `git fetch origin main`.
- Lint, type-check, and tests pass:
  - Backend: `cd server && uv run task lint && uv run task lint_types && uv run task test_fast`
  - Frontend: `clients/AGENTS.md` (`pnpm lint`, `pnpm typecheck`, scoped tests)
- PR body: no PII, stats, or org information. PRs are public.
- Title from the user or the diff. Body:

```
# Summary

👇 LLM generated

<what this PR does>

## What

## Why

## How

## Checklist
```

Fill the headings from `.github/pull_request_template.md`.

If lint or tests fail, stop. Do not review or open a PR.

## 2. Polar code review

Read `.agents/skills/polar-code-review/SKILL.md` and follow it exactly.

Address every finding (🔴, 🟠, 🟡, 🧹). Then rerun this step.

## 3. Cubic CLI review

If `CUBIC_API_KEY` is unset, skip this step and say so. Do not fail closed.

Otherwise:

```bash
cubic review --base origin/main --json
```

Address every finding. If the diff changed, rerun step 2. Repeat until clean or
only disputed issues remain. Exit code 1 means work to do, not a skip.

## 4. Open the draft

Create or update a **draft** PR.

- GitHub CLI: `gh pr create --draft`, or update the existing PR
- Cursor cloud: `ManagePullRequest` with `draft: true`

After the PR exists, pull review comments and address them the same way.

## 5. Reply

Exactly this. Nothing else.

```
Done
<summary>
<summary>
PR link: <url>
```

`Failed` instead of `Done` if you stopped (lint, tests, or an unfixed comment).
Two-line summary of what shipped or why it failed. Omit the PR line only if no
PR exists.
