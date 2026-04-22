# Create Changelog

Produce a polished changelog entry for `docs/changelog/recent.mdx` covering recently shipped merchant and customer facing features. Delegate research and screenshots to subagents, and confirm the feature list with the user before writing anything.

## Arguments

`$ARGUMENTS` may contain a time range and an optional `--confirm` flag.

Time range (optional):
- Nothing (default: last 7 days)
- A number of days (e.g. `14`)
- A date range (e.g. `2026-04-15..2026-04-22`)

Confirmation flag (optional):
- `--confirm` enables the user confirmation step (step 3). **Off by default.** When omitted, proceed straight from research to screenshots with the subagent's chosen classifications.

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

Launch a `general-purpose` subagent with the full commit list. Also pass it the content of every prior `<Update>` block in `docs/changelog/recent.mdx` from the last 90 days (the "monthly log") so it has a deduplication baseline. Tell it to:

- Filter the list using the include and exclude rules above. Be conservative.
- For each candidate, run `gh pr view <n>` and inspect changed files to confirm the feature is real, user-visible, and shipped in this window (not a docs update for a feature that shipped earlier).
- **Dedupe against the monthly log**: drop anything already announced. An *enhancement* to a previously-announced feature is fine to include if it is materially new (e.g. new filters added to a list that shipped last month), but say so clearly and frame it as an enhancement.
- **Cap the final set at 10 features.** Rank by merchant / customer impact and cut the tail.
- Decide which are **MAJOR** (warrants a screenshot) and which are **MINOR**. Decide yourself, do not ask the user.
- For MAJOR items, describe the exact URL to screenshot and what must be visible on screen.
- Return a structured list: title, 2-3 sentence plain-English summary, category, screenshot target, PR number, and a one-line note on dedupe (new feature vs. enhancement of X).

Instruct the subagent explicitly: no em dashes, no Stripe, no perf-only or security-hardening items.

### 3. Confirm the final list with the user (only if `--confirm` was passed)

**Skip this step entirely unless the user passed `--confirm` in `$ARGUMENTS`.** By default, go straight from step 2 to step 4 using the subagent's classifications as the final list.

When `--confirm` is passed, use the `AskUserQuestion` tool to present the (up to 10) features the subagent selected. For each item, offer three options: `MAJOR` (include with screenshot), `MINOR` (include, no screenshot), `SKIP`. **Pre-mark the option the subagent recommended** so the user sees a clear recommendation and only has to override where they disagree. Batch everything into one or two questions.

Apply the user's choices, then continue.

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

- Log in at `http://localhost:<web-port>/login` as the seeded owner of the org the feature lives in (e.g. `support@meltedsql.com` for MeltedSQL, `admin@polar.sh` for admin-org). Dev skips DNS deliverability so fake seed domains are accepted. Grab the login code with `docker logs polar-dev-<N>-api-1 --since 30s 2>&1 | grep -oE 'LOGIN CODE: [A-Z0-9]+' | tail -1`.
- **Prefer clicking through the UI or calling documented API endpoints to create the state you need.** That path exercises real validation and produces screenshots that will not drift when schemas change. Fall back to direct SQL only for states the product does not let you reach through normal flows (e.g. placing a subscription into a pre-scheduled update that is applied by a cron job), or for minor tidy-up so the UI reads clearly (e.g. removing placeholder rows that distract from what the screenshot is about).
- Read the relevant frontend component first to understand what data the screenshot actually needs, then pick the shortest path to get there.
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
