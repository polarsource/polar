---
name: verifier-web
description: Two-phase verify for web/dashboard/backoffice/checkout changes in the Polar local stack. Phase 1 proves the change works by driving the real UI with Playwright (login via email-OTP, live Stripe checkout, screenshots as evidence). Phase 2, gated on phase 1 passing, adds a minimal E2E spec when the change warrants a lasting guard (deduping against existing specs) and runs the whole Playwright suite as a regression check. Auto-discovered by the built-in /verify skill; can also be invoked directly.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Web Verifier (Polar)

The handle is the **browser**. The evidence is **screenshots + the resulting
DB/backoffice state**. This skill is the repo's replay protocol for any change
that a user — human or programmatic — meets through the web UI: the dashboard,
the checkout, or the backoffice.

Use the [`local-environment`](../local-environment/SKILL.md) skill for all stack
mechanics (start/stop/logs/instances). This skill adds the browser-driving and
auth/payment recipe on top.

## Two phases

`/verify` runs in two gated phases. Do them in order:

1. **Functionality** — prove *this change* works, by driving it in the real UI
   (the rest of this skill). Capture evidence.
   **Gate:** if the change fails or is BLOCKED, stop here and report. Do not run
   the regression phase on a change that doesn't work.
2. **E2E regression** — only if phase 1 PASSed: plan + author E2E tests for the
   change, then run the whole suite so we know nothing else broke. See
   [Phase 2](#phase-2--e2e-regression) below.

## When to use

- Verifying a dashboard, checkout, or backoffice change.
- Confirming login works, or a flow that requires being logged in.
- Proving a purchase / subscription path end-to-end against live Stripe (test mode).

For CLI/API/library changes, use the built-in `/verify` surfaces instead — this
skill is for pixels.

## Tooling

Drive the browser with the **Playwright MCP** (`mcp__playwright__*`). Prefer
`browser_snapshot` (accessibility tree, gives refs) over screenshots for
*acting*; use `browser_take_screenshot` for *evidence*. Read backend state with
`dev docker exec db psql` and `docker logs`.

## 1. Bring up the stack

```bash
dev docker ps          # allocates/detects this worktree's instance number N
dev docker up -d       # build + migrate + seed on first run (several minutes)
```

`dev docker up` prints the **authoritative** ports — always read them from its
output, do not compute them. They look like:

```
API:  http://localhost:81NN
Web:  http://localhost:31NN
```

(`N` is the instance; e.g. instance 7 → API `:8107`, Web `:3107`. Container
names are `polar-app-<N>-api-1`, `-web-1`, `-worker-1`; DB is `polar_dev_<N>`.)

Poll readiness before driving anything:

```bash
for i in $(seq 1 60); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:81NN/healthz)
  w=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:31NN)
  # web may answer 200/307/308 (Next.js dev redirects/compiles on first hit)
  [ "$a" = 200 ] && [ "$w" -ge 200 ] && [ "$w" -lt 400 ] && break; sleep 5
done
```

## 2. Log in (dashboard + backoffice share one cookie)

Log in through the **real email-OTP flow**. The backoffice at
`http://localhost:81NN/backoffice/` uses the same user-session cookie, so logging
into the dashboard authenticates the backoffice too.

1. `browser_navigate` → `http://localhost:31NN/auth`
   (the nav "Login" link is hidden; go to `/auth` directly. `/login` 404s.)
2. Type `admin@polar.sh` into the Email field, click **Sign in with email**.
   The seed account `admin@polar.sh` owns `admin-org` (approved, payout account,
   products) — go straight to checkout testing, no onboarding.
3. The page advances to `/auth/email-otp`. Read the code from the api logs:
   ```bash
   docker logs --since 60s polar-app-<N>-api-1 2>&1 | grep -A1 "LOGIN CODE"
   ```
4. Type the 6-character code (uppercase letters + digits, e.g. `C9YLIF`) → lands
   on `/dashboard/admin-org`.
5. Backoffice: `browser_navigate` → `http://localhost:81NN/backoffice/`.

The backoffice needs compiled assets (Tailwind/DaisyUI → `static/styles.css` +
`scripts.js`). On a clean start these are **often not built yet** — the
backoffice then renders unstyled and `/backoffice/static/styles.css` +
`scripts.js` 404 (served as `application/json`). Build them once:

```bash
cd server && uv run task backoffice
```

The output lands in `server/polar/backoffice/static/` on the host, which is
mounted into the api container — it's picked up live, no recreate needed.
(`dev docker up` has a "Building backoffice assets" step, but don't rely on it
having run; check that the backoffice is styled and rebuild if not.)

### Login prerequisite — the auth-session cookie domain

Login through the browser **requires** the auth-session cookie domain to match
the host the frontend uses (`localhost`). This is set in
`dev/docker/docker-compose.dev.yml`:

```yaml
POLAR_USER_SESSION_COOKIE_DOMAIN: localhost
POLAR_AUTHENTICATION_SESSION_COOKIE_DOMAIN: localhost   # both must be present
```

If you see **`POST /v1/auth/email-otp/request` → 401 "Invalid or missing
authentication session token"**, the `Set-Cookie` from `/auth/start` is being
dropped because its `Domain=` doesn't match the page host. Check:

```bash
curl -si -X POST http://localhost:81NN/v1/auth/start \
  -H 'Origin: http://localhost:31NN' -H 'Content-Type: application/json' \
  -d '{"return_to":"/dashboard"}' | grep -i set-cookie
```

`Domain=localhost` → good. `Domain=127.0.0.1` → the override above is missing;
add it, then **recreate** the api (`dev docker up -d api` — a restart does NOT
reload compose env). Do not fall back to minting/injecting a session cookie.

## 3. Purchase end-to-end (live Stripe test mode)

A real purchase needs (a) a valid Stripe **sandbox** key on api **and worker**,
and (b) a webhook listener forwarding to the api. Order creation is async — the
api 202s the webhook and the **worker** creates the order.

### 3a. Stripe account + keys

Use **your own Stripe sandbox / test-mode account** — any test account works.
Never use a production account or a real personal account; test mode only.

**Secrets are set up once and reused across worktrees.** They live centrally in
`~/.config/polar/secrets.env` and `dev/setup-environment` propagates them into
each worktree's `server/.env`. So you don't redo Stripe setup per worktree —
populate the central file once. The one-step path:

```bash
dev stripe --listen --port <api-port>   # <api-port> = the API port from `dev docker up`
```

This installs/logs-in the Stripe CLI if needed, writes the API keys + webhook
secret into the central secrets file, propagates them, and starts the webhook
listener (3b). If the CLI is already configured it skips straight to listening.

CLI test keys expire every 90 days. Symptom of an expired key: checkout sticks on
"We are processing your order" and the worker/api logs show
`AuthenticationError: Expired API Key provided`. Refresh by re-running
`stripe login` for your sandbox project (or `dev stripe`), then recreate services
(3c).

If you ever set keys by hand, set them in the central file (or `server/.env`) and
keep them on the **same account**: `POLAR_STRIPE_SECRET_KEY` (the secret key),
`POLAR_STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_STRIPE_KEY` (the publishable key —
the browser tokenizes the card with it). pk and sk must belong to one account or
the card tokenizes against one account while the backend charges another.

### 3b. Webhook listener

`dev stripe --listen --port <api-port>` starts it for you. To run it directly in
the background with its output captured to a log you can grep later:

```bash
stripe listen \
  --forward-to http://localhost:81NN/v1/integrations/stripe/webhook \
  --forward-connect-to http://localhost:81NN/v1/integrations/stripe/webhook-connect \
  > /tmp/stripe-listen.log 2>&1 &
```

(If you started it via `dev stripe --listen` instead, its events print in that
command's terminal — redirect to a file as above if you want to grep them in 3e.)

It prints `Your webhook signing secret is whsec_...`. **Both**
`POLAR_STRIPE_WEBHOOK_SECRET` and `POLAR_STRIPE_CONNECT_WEBHOOK_SECRET` must equal
that secret. Leave the listener running in the background. If webhooks come back
400 (signature failure), the configured secret is stale — re-sync it to the value
the listener prints.

### 3c. Recreate ALL THREE services after any key change

```bash
dev docker up -d api web worker
```

**The worker is easy to forget** — if it keeps a stale/expired key, the api will
202 the webhook but order creation fails silently and retries forever. Recreate
api, web, *and* worker on every env change.

### 3d. Drive the checkout

1. Find/make a checkout link for an `admin-org` product, then open its redirect
   to start a checkout session. The redirect token is the link's
   **`client_secret`** (the `polar_cl_...` value — not the UUID `id`):
   ```
   http://localhost:81NN/v1/checkout-links/<polar_cl_...>/redirect
   ```
   List it (qualify the column — both tables have `id`/`client_secret`):
   ```sql
   select cl.client_secret from checkout_links cl
     join organizations o on o.id = cl.organization_id
     where o.slug = 'admin-org' limit 1;
   ```
2. Fill the form:
   - **Email** — real domain + tag, e.g. `petru+verify-<flow>@polar.sh`.
     `.local` and `example.com` are rejected by checkout email validation.
   - **Card** (inside the Stripe iframe): `4242 4242 4242 4242`, exp `12 / 34`,
     CVC `123`.
   - **Cardholder name**, then **Billing country** (Radix combobox — click to
     open, click the option). Selecting **United States** reveals required
     **address line1, city, state (Radix combobox), ZIP** — fill all. React
     inputs need the native value-setter + an `input` event if you set them via
     `browser_evaluate`.
3. Click **Subscribe now** / **Pay**. The page goes to `…/confirmation` showing
   "We are processing your order", then "**Thank you for your order!**".

**Test cards** (Stripe test mode; any future expiry, any 3-digit CVC, any ZIP):

| Outcome | Number |
|---|---|
| Success | `4242 4242 4242 4242` |
| Requires 3DS / authentication | `4000 0027 6000 3184` |
| Generic decline | `4000 0000 0000 0002` |
| Insufficient funds decline | `4000 0000 0000 9995` |

Verify the unhappy paths too: a decline should surface an inline card error and
create **no** order; a 3DS card should pop the authentication modal. Full list:
https://docs.stripe.com/testing.

### 3e. Verify the result (don't trust the UI alone)

```bash
# webhook delivery (expect charge.succeeded + payment_intent.succeeded → 202)
# from the listener log you captured in 3b:
grep -E 'POST|payment_intent|charge' /tmp/stripe-listen.log

# order + subscription created by the worker
dev docker exec db psql -U polar -d polar_dev_<N> -tc \
 "select o.status, o.net_amount_v2, c.email from orders o
   join customers c on c.id=o.customer_id
   where c.email='petru+verify-<flow>@polar.sh' order by o.created_at desc limit 1;"
```

Expect `paid | 2000 | …`. Also confirm it renders in backoffice **Orders**
(`/backoffice/orders/`). Screenshot the confirmation page and the backoffice row.

## Phase 2 — E2E regression

Run this **only after phase 1 PASSed.** The goal: keep the suite an honest
regression guard for the flows that matter, then confirm it's still green.

The suite lives in `clients/apps/web/e2e/` (Playwright) and runs against this
worktree's dev-docker stack. See `clients/apps/web/e2e/README.md` for its layout.
**Keep it minimal** — a small suite of high-value flows, not a spec per change.

1. **Add a spec only when the change warrants a lasting guard** — a new
   user-facing feature, or a bug fix whose regression you want caught next time.
   Refactors, copy tweaks, and internal changes usually need **no new spec**.
   - **Dedup first.** If a spec already covers this flow, extend or adjust it
     rather than adding a near-duplicate. Do not add a second spec for a flow the
     suite already exercises.
   - Author it yourself following the repo conventions: import `{ test, expect }`
     from `e2e/fixtures.ts`, reuse the `support/` helpers, use role-based locators,
     and assert real content (a product row by href, a rendered value — not just a
     nav link or the URL). Drive the change once in the live UI to get stable
     selectors before writing them.
2. **Run the whole suite:**
   ```bash
   dev e2e
   ```
   `dev e2e` bootstraps what it needs (browser, stack, seed), then runs all specs
   in parallel.
3. **Triage failures:**
   - **Selector drift** in an existing spec (the app changed, the test is stale)
     → reproduce it in the live UI, repair the spec (scope edits to `e2e/`), re-run.
   - **A real regression** (your change broke another flow) → this is the signal
     the phase exists for. Stop and report it; don't paper over it.
4. The phase PASSes when any new/changed spec and the full suite are green.

## Report

Follow the built-in `/verify` report format: Verdict (PASS/FAIL/BLOCKED/SKIP),
Claim, Method, and numbered Steps where each step is one thing you did to the
**running app** and what it showed — attach the screenshots. Test runs and
typechecks are not steps. Note anything that made you pause (a slow poll, a
stale-key retry, a confusing validation message) — that's the signal.

## Gotchas seen in practice

- Restart ≠ recreate. `dev docker restart` keeps the old compose env; use
  `dev docker up -d <svc>` to load env/key changes.
- The api session is DB-backed, so recreating the api keeps you logged in.
- `dev stripe --listen` skips re-saving the webhook secret when keys are already
  configured — so a rotated signing secret won't propagate. Set it by hand (3b)
  if webhooks 400 on signature.
