# Create Changelog

Produce a polished changelog entry for `docs/changelog/recent.mdx` covering recently shipped merchant and customer facing features. Delegate research and screenshots to subagents, and confirm the feature list with the user before writing anything.

## Arguments

`$ARGUMENTS` is the time range to cover. Accepts:
- Nothing (default: last 7 days)
- A number of days (e.g. `14`)
- A date range (e.g. `2026-04-15..2026-04-22`)

## Style Rules (non-negotiable)

- **No em dashes** (`—`) or en dashes (`–`) anywhere in the entry. Use commas, periods, parentheses, or rewrite the sentence.
- **Never mention Stripe** or other payment processors by name.
- Each feature: a short title and no more than 5 lines of copy.
- Write for merchants and customers, not engineers. Say what the reader can now do and why it matters.
- Use the `<Update label="YYYY-MM-DD">` block format. The date is today.
- Reference images as `/assets/changelog/YYYY-MM-DD/<name>.png` with `<img class="border rounded" src="..." />`.

## What to Include

High-signal, externally visible changes:
- New merchant features (dashboard, API, webhooks, invoicing).
- New customer features (checkout, customer portal, seats).
- New localization, currency, or i18n coverage.

## What to Exclude (be strict, err on the side of dropping)

- Bug fixes, regressions, and reverts. These are not changelog material.
- Performance improvements with no visible behavior change (SSR speedups, cache layers, faster filter batching, infra tuning).
- Security hardening that does not change what users can do (tighter auth on an existing flow, secret requirement for an internal handshake, rate limit changes).
- Backoffice and admin-only work.
- Internal refactors, migrations, backfills, column drops, capability rollouts, model additions.
- Dependency bumps, CI/CD, dx, test additions, lint changes.
- Legal or policy text updates.
- Organization status, review, appeal, or onboarding lifecycle plumbing.
- **Docs-only changes.** If the PR only touches `docs/` or `handbook/`, the feature likely shipped weeks ago. Do not include it. Verify by grepping the code for the feature before including it.

When in doubt, leave it out. It is much better to ship a short changelog than a bloated one.

## Steps

### 1. Gather commits

Resolve the range from `$ARGUMENTS` and list the merged PRs:

```bash
git log --since="7 days ago" --pretty=format:"%h|%ad|%s" --date=short --no-merges
```

If the user gave a date range, use `--since` and `--until` accordingly.

### 2. Research features (subagent, `general-purpose`)

Launch a `general-purpose` subagent with the full commit list. Tell it to:

- Filter the list using the include and exclude rules above. Be conservative.
- For each candidate, run `gh pr view <n>` and inspect changed files to confirm the feature is real, user-visible, and shipped in this window (not a docs update for a feature that shipped earlier).
- Classify each surviving item as **MAJOR** (warrants a screenshot) or **MINOR**.
- For MAJOR items, describe the exact URL to screenshot and what must be visible on screen.
- Return a structured list: title, 2-3 sentence plain-English summary, category, screenshot target, and the PR number / author.

Instruct the subagent explicitly: no em dashes, no Stripe, no perf-only or security-hardening items.

### 3. Confirm the feature list with the user (MANDATORY)

Before touching the changelog file or seeding any data, use the `AskUserQuestion` tool to present every candidate returned by the research subagent and let the user decide what stays. For each item, offer three options: `Include as MAJOR` (with screenshot), `Include as MINOR` (no screenshot), or `Skip`. Batch into one or two questions so the user is not asked dozens of things in a row.

Do not proceed past this step with anything the user did not explicitly accept.

### 4. Prepare the local environment (main session)

Only if any accepted MAJOR feature needs a screenshot. Invoke the `local-environment` skill to start the stack if it is not running:

```bash
dev docker ps
dev docker up -d
```

Wait for the web port to be reachable (`dev docker ps` shows the instance-specific port, e.g. 4200 for instance 12).

If the DB is empty, seed it:

```bash
docker exec polar-dev-<N>-api-1 bash -c "cd /app/server && uv run python -m scripts.seeds_load"
```

### 5. Capture screenshots (subagent, `general-purpose`)

Launch a `general-purpose` subagent with the list of accepted MAJOR features. Tell it:

- Log in at `http://localhost:<web-port>/login` as `admin@polar.sh`. The email domain must be real (polar.sh works) or login validation rejects it. Grab the login code with `docker logs polar-dev-<N>-api-1 --since 30s 2>&1 | grep -oE 'LOGIN CODE: [A-Z0-9]+' | tail -1`.
- If a feature lives in an org that `admin@polar.sh` is not a member of, rename the seeded owner's email to a real `@polar.sh` domain (e.g. `UPDATE users SET email='merchant@polar.sh' WHERE email='support@meltedsql.com'`) and restart the web container so Next.js re-fetches the user's org list: `docker restart polar-dev-<N>-web-1`.
- Figure out the minimal data needed for each screenshot by reading the relevant frontend component. Seed via SQL when possible (e.g. an `INSERT` into a scheduled-change table or toggling a `feature_settings` JSON key) rather than clicking through flows.
- Clean up distracting placeholder rows so the UI reads clearly (e.g. remove pending seats if the screenshot should highlight claimed ones).
- Use Playwright MCP (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_take_screenshot`) and save to `docs/assets/changelog/YYYY-MM-DD/<slug>.png`. Create the directory first.
- Return the list of saved paths.

### 6. Write the entry (main session)

Prepend a new `<Update label="YYYY-MM-DD">...</Update>` block at the top of `docs/changelog/recent.mdx`, after the frontmatter and before the previous most-recent entry. For each accepted feature:

```mdx
## <Feature Title>

<2 to 5 line summary, no em dashes, no Stripe>

<img class="border rounded" src="/assets/changelog/YYYY-MM-DD/<slug>.png" />
```

Order: MAJOR features (with screenshots) first, then MINOR features.

### 7. Verify

Inside the new block only:
- `grep -nE '—|–'` must return nothing.
- `grep -nE '[Ss]tripe'` must return nothing.
- Every `<img src=...>` path must exist on disk.

### 8. Report to the user

List every feature included (title plus one line) and the paths to the screenshots captured. Stop there. Do not create a commit or a PR unless the user asks.
