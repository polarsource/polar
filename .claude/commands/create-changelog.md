# Create Changelog

Produce a polished changelog entry for `docs/changelog/recent.mdx` covering recently shipped merchant and customer facing features. Delegate research, seeding, and screenshots to subagents in parallel where possible.

## Arguments

`$ARGUMENTS` is the time range to cover. Accepts:
- Nothing (default: last 7 days)
- A number of days (e.g. `14`)
- A date range (e.g. `2026-04-15..2026-04-22`)

## Style Rules (non-negotiable)

- **No em dashes** (`—`) or en dashes (`–`) in the entry. Use commas, periods, parentheses, or rewrite the sentence.
- **Never mention Stripe** or other payment processors by name.
- Each feature: a short title and no more than 5 lines of copy.
- Write for merchants and customers, not engineers. Say what the reader can now do and why it matters.
- Use the existing `<Update label="YYYY-MM-DD">` block format. The date is today.
- Reference images as `/assets/changelog/YYYY-MM-DD/<name>.png` with `<img class="border rounded" src="..." />`.

## What to Include

- Merchant facing features (dashboard, API, webhooks, invoicing).
- Customer facing features (checkout, customer portal, seats).
- Localization, currency, and i18n improvements.

## What to Exclude

- Bug fixes (`fix:`, `fix(...)`) unless the behavior change is a notable merchant-visible feature.
- Backoffice and admin-only work.
- Internal refactors, migrations, backfills, column drops, capability rollouts.
- Dependency bumps, CI/CD, dx, test additions.
- Legal or policy text updates.
- Organization status, review, or onboarding lifecycle plumbing.

## Steps

### 1. Gather commits

Resolve the range from `$ARGUMENTS` and get the list of merged PRs:

```bash
git log --since="7 days ago" --pretty=format:"%h|%ad|%s" --date=short --no-merges
```

If the user gave a date range, use `--since` and `--until` accordingly.

### 2. Research features (subagent, `general-purpose`)

Launch a `general-purpose` subagent with the full commit list. Tell it to:

- Filter the list using the include / exclude rules above.
- For each candidate PR, run `gh pr view <n>` and inspect changed files to understand the feature.
- Classify each surviving item as **MAJOR** (warrants a screenshot) or **MINOR**.
- For MAJOR items, describe the exact URL to screenshot (page + what must be visible) and any data prerequisites.
- Return a structured list: title, 2-3 sentence plain-English summary, category, screenshot target, prerequisites.

Instruct the subagent explicitly: do not use em dashes or mention Stripe in its summaries.

### 3. Prepare the local environment (main session)

In parallel with step 2, invoke the `local-environment` skill to start the stack if it is not running:

```bash
dev docker ps
dev docker up -d   # if nothing is running
```

Wait for the web to be reachable: `until curl -sf http://localhost:<web-port>/ > /dev/null; do sleep 2; done`. The web port depends on the auto-detected instance; use `dev docker ps` output to find it.

If the DB has no seeded data, run:

```bash
docker exec polar-dev-<N>-api-1 bash -c "cd /app/server && uv run python -m scripts.seeds_load"
```

### 4. Log in and seed data for screenshots (subagent, `general-purpose`)

Launch a `general-purpose` subagent with **isolation: worktree is NOT needed** (it needs to touch the running containers). Give it the list of MAJOR features from step 2 and tell it to:

- Log in at `http://localhost:<web-port>/login` using `admin@polar.sh`. The domain must be real (polar.sh) or login validation rejects it. Grab the login code with:
  ```bash
  docker logs polar-dev-<N>-api-1 --since 30s 2>&1 | grep -oE 'LOGIN CODE: [A-Z0-9]+' | tail -1
  ```
- For an org that is not in `admin@polar.sh`'s membership, rename a seeded user's email to a real `@polar.sh` domain (e.g. `UPDATE users SET email='merchant@polar.sh' WHERE email='support@meltedsql.com'`) and restart the web container so Next.js re-fetches the user's org list:
  ```bash
  docker restart polar-dev-<N>-web-1
  ```
- Seed data for each MAJOR feature directly in Postgres:
  - **Pending subscription update**: insert into `subscription_updates` with `applies_at` set to the subscription's `current_period_end` and `applied_at` left null. Also clean up any distracting rows (e.g. delete `pending` seats so the "N of M seats available" counter makes sense).
  - **Locale-aware checkout**: set `organizations.feature_settings -> 'checkout_localization_enabled'` to `true`, then hit `GET /v1/checkout-links/<client_secret>/redirect?locale=<code>` on the API port to get redirected to a localized checkout.
  - **License key filters**: navigate to the benefit detail page. The filter dropdown is always visible even with no data.
- Take each screenshot with Playwright MCP (`mcp__playwright__browser_navigate` + `mcp__playwright__browser_take_screenshot`). Save to `docs/assets/changelog/YYYY-MM-DD/<feature-slug>.png`. Create the directory first.
- Return the list of saved paths.

Smaller features that are frontend related are "appreciated but not required" screenshots. Only capture them if the subagent can do so without additional seeding.

### 5. Write the entry (main session)

Prepend a new `<Update label="YYYY-MM-DD">...</Update>` block at the top of `docs/changelog/recent.mdx`, after the frontmatter and before the most recent existing entry. For each feature:

```mdx
## <Feature Title>

<2 to 5 line summary, no em dashes, no Stripe>

<img class="border rounded" src="/assets/changelog/YYYY-MM-DD/<slug>.png" />
```

Order: MAJOR features (with screenshots) first, then MINOR features.

### 6. Verify

- Grep the new block for em / en dashes: `sed -n '/<Update label="YYYY-MM-DD">/,/<\/Update>/p' docs/changelog/recent.mdx | grep -nE '—|–'`. Fix any hits.
- Grep for `[Ss]tripe` in the new block. Reword anything that mentions it.
- Confirm every `<img src=...>` path exists on disk.

### 7. Report to the user

List every feature included (title + one line) and the paths to the screenshots captured. Stop there. Do **not** run `/yeet` or create a PR unless the user asks.
