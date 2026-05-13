# Yeet

Lint, type-check, and create a PR.

## Instructions

1. **Get the diff** against main to determine what changed:
   ```bash
   git diff --name-only main...HEAD
   ```

2. **Run steps in parallel based on what changed**, using the Bash tool:

   If ANY file under `server/` changed:
   - **Backend lint**: `cd server && uv run task lint`
   - **Backend type check**: `cd server && uv run task lint_types`

   If ANY file under `clients/` changed:
   - **Web lint**: `cd clients && pnpm lint`

   Launch all applicable steps in parallel.

3. **If any step fails**, fix the issues and re-run only the failing step. Repeat until all pass.

4. **If lint auto-fixed files** (e.g. ruff formatted), stage and commit those changes with a message like "lint: auto-fix formatting".

5. **Create the PR as a draft** using the standard PR creation instructions from the system prompt. Use the full commit history from `main` to draft the PR title and description. Pass `--draft` to `gh pr create`.

   **PR title must use a conventional commit prefix** — one of: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `perf:`, `ci:`, `build:`, `style:`. Choose the prefix that best describes the overall change. Examples:
   - `feat: add webhook retry with exponential backoff`
   - `fix: prevent duplicate subscription charges`
   - `refactor: extract payment validation into service layer`

   This is important because we use **merge queues with squash**, so the PR title becomes the final commit message on `main`.

   **Build the description from the repo PR template.** Before writing the body, read `.github/pull_request_template.md` and use it as the structural guide. Keep the section headers you use (e.g. `## Summary`, `## What`, `## Why`, `## How`, `## Checklist`) consistent with the template.

   - Include only the sections that add real information for this PR. Skip any section that would otherwise be empty or trivial. A small fix may only need `## Summary`; a feature may need `## Summary` + `## What` + `## Why`.
   - Always keep the `## Checklist` section from the template. Tick the boxes for items you actually verified in this run (e.g. lint and type checks passed → tick the lint/type-check box; the PR is genuinely focused and small → tick those boxes). Leave unchecked anything you did not verify (e.g. you did not add tests).
   - Omit `Related Issue: #<n>` unless an issue is actually referenced in the branch or commits.
   - Each kept section is at most a couple of short sentences or a few short bullets. A reviewer should scan the whole PR body in under a minute. Do not pad, do not restate the diff line-by-line.

   **Important — this is a public repo.** When writing the PR title and description:
   - **No PII**: Do not include any personally identifiable information such as names, emails, user IDs, API keys, tokens, internal URLs, or customer data — even if they appear in commit messages or diffs.
   - **No stats data**: Do not include specific metrics, revenue figures, user counts, conversion rates, or any other business/analytics data that may appear in the code changes.
   - Describe *what* the changes do and *why*, without exposing sensitive details.
