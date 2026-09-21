---
name: open-pr
description: Open or update a draft GitHub pull request after Polar-specific review and cubic CLI review. Use when opening a PR, including drafts, or when the user asks to open-pr, /open-pr, or $open-pr.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Open PR

Open or update a **draft** pull request. Do not mark it ready for review.

This is not a bug hunt and not a security review. `/code-review`, `/security-review`,
and `/simplify` do those. Do not run Cursor `/review` here.

## 1. Preconditions

- Working tree committed. Branch pushed. `git fetch origin main`.
- Lint, type-check, and tests pass:
  - Backend: `cd server && uv run task lint && uv run task lint_types && uv run task test_fast`
  - Frontend: `clients/AGENTS.md` (`pnpm lint`, `pnpm typecheck`, scoped tests)
- PR body: no PII, stats, or org information. PRs are public.
- Body from `.github/pull_request_template.md`. Title from the user or the diff.

If lint or tests fail, stop. Do not review or open a PR.

## 2. Polar code review

Read `.agents/skills/polar-code-review/SKILL.md` and follow it exactly.

- Any 🔴: fix, commit, push, and rerun this step. Do not continue.
- 🟠: judgement call — say which way you lean. Continue only if you would still ship a draft.
- 🟡: expected; do not block on questions alone.

## 3. Cubic CLI review

If `CUBIC_API_KEY` is unset, skip this step and say so. Do not fail closed.

Otherwise:

```bash
cubic review --base origin/main --json
```

- Fix validated findings, commit, push, then rerun cubic.
- If the diff changed, rerun step 2 before opening the PR.
- Repeat until the local review is clean or only disputed issues remain.
- `cubic review` exits 1 when it reports findings; that is work to do, not a skip.
- Cubic's GitHub review after the PR exists uses a different model. Do not treat
  the CLI as the final pass.

## 4. Open the draft

Create or update a **draft** PR. Do not mark it ready.

- GitHub CLI: `gh pr create --draft`, or update the existing PR
- Cursor cloud: `ManagePullRequest` with `draft: true`

After the PR exists, Cubic's GitHub review may find issues the CLI missed. Fix those
on the same PR.
