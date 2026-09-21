---
name: open-pr
description: Open or update a draft GitHub pull request after Polar-specific review and cubic CLI review. Use when opening a PR, including drafts, or when the user asks to open-pr, /open-pr, or $open-pr.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Open PR

Open or update a **draft** pull request. Polar-specific review first, then cubic CLI,
then the PR. Do not mark it ready for review.

If the user gave a PR title, use it. Otherwise write one from the branch diff.

This is not a bug hunt and not a security review. `/code-review`, `/security-review`,
and `/simplify` do those. Cursor `/review` (the Bugbot vs security chooser) is also
not this skill — do not run it here.

Hosts load this skill from `.agents/skills/` (Cursor, Codex) and from `.claude/skills`,
which is a symlink to that directory (Claude Code). Invoke as `/open-pr` in Cursor or
Claude Code, or `$open-pr` in Codex.

## 1. Preconditions

- Working tree committed. Branch pushed.
- Lint, type-check, and tests pass:
  - Backend: `cd server && uv run task lint && uv run task lint_types && uv run task test_fast`
  - Frontend: `clients/AGENTS.md` (`pnpm lint`, `pnpm typecheck`, scoped tests)
- PR body: no PII, stats, or org information. PRs are public.
- Use `.github/pull_request_template.md` when creating the body.

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
cubic review --base main --json
```

Use `--output-format stream-json` when you need progress events.

- Fix validated findings, commit, push, then rerun cubic.
- If the diff changed, rerun step 2 before opening the PR.
- Repeat until the local review is clean or only disputed issues remain.
- `cubic review` exits 1 when it reports findings; that is work to do, not a skip.
- Cubic's GitHub review after the PR exists uses a different model. Do not treat
  the CLI as the final pass.

## 4. Open the draft

Create or update a **draft** PR. Do not mark it ready.

Use the host's PR tool:

- GitHub CLI: `gh pr create --draft`, or update the existing PR
- Cursor cloud: `ManagePullRequest` with `draft: true`

Title from the user message or the diff. Body from the PR template.

## 5. After the PR exists

Cubic's GitHub review may find issues the CLI missed. Fix those on the same PR.
Optional: `/code-review`, `/security-review`, or Bugbot if the user asks.
