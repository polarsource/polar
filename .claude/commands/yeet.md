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

5. **Create the PR** using the standard PR creation instructions from the system prompt. Use the full commit history from `main` to draft the PR title and description.
