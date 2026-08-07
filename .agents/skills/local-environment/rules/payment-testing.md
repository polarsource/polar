---
title: Testing Auth and Payment Flows Locally
category: Operations
tags: stripe, dramatiq, auth, backoffice, checkout
---

# Testing Auth and Payment Flows Locally

Most non-trivial bug reports against the local stack touch one of: login,
Stripe webhooks, subscription renewals, refunds, or the backoffice. These
all have small environmental quirks that aren't obvious from the source —
this rule collects them in one place.

## Logging In

Email login codes are printed in the api container logs as a banner:

```
╔══════════════════════════════════════════════════════════╗
║                   🔑 LOGIN CODE: ABCDE1                  ║
╚══════════════════════════════════════════════════════════╝
```

Grab the latest one:

```bash
docker logs --since 30s polar-app-<N>-api-1 2>&1 | grep -A1 "LOGIN CODE"
```

Use `admin@polar.sh` as the default test account — the seed creates it with
an approved org (`admin-org`) that already has a payout account, identity
verification, and at least one product. That lets you go straight to
checkout testing without onboarding work.

## Stripe Sandbox and Webhooks

```bash
dev stripe --listen
# or, for a non-default instance, pass the API port from `dev docker ports`:
dev stripe --listen --port <api-port>
```

Local environments always run against a **personal Stripe sandbox** — never a
live account, and never a shared team account. `dev` refuses both with one
structural check: the linked profile must hold test keys, and since a sandbox
has no live mode at all, the Stripe CLI must have stored no live key for it.
A shared team account is a live account, so it fails that check.

The Stripe CLI profile is always named `polar-sandbox`, so `dev` never
depends on whichever account the CLI happens to have active. Pass
`-p polar-sandbox` when running `stripe` by hand.

`dev stripe --listen` handles the full setup in one step: installs the
Stripe CLI if missing, walks through creating/linking a sandbox, writes
`POLAR_STRIPE_SECRET_KEY`, `POLAR_STRIPE_PUBLISHABLE_KEY`, and
`POLAR_STRIPE_WEBHOOK_SECRET` into the central secrets file, runs
`dev/setup-environment` to propagate them, and then starts `stripe listen`
forwarding to both the regular webhook endpoint and the Stripe Connect
endpoint (`/v1/integrations/stripe/webhook` and
`/v1/integrations/stripe/webhook-connect`). Re-running it later just starts
the listener. `dev stripe --relink` switches to a different sandbox.

Stripe CLI keys expire after 90 days. An expired key shows up as
`The API key provided has expired` — `dev stripe` detects it and re-runs the
link flow.

`--port` defaults to `8000`. Conductor worktrees and multi-instance setups
land outside the 0–2 base-port table, so read the api port from
`dev docker ports` rather than computing it.

Leave it running and `stripe listen` will log each event with the API's
2xx response. Missing webhook → confirm the api port matches
`dev docker ports`.

One listener signs both endpoints, so `POLAR_STRIPE_WEBHOOK_SECRET` and
`POLAR_STRIPE_CONNECT_WEBHOOK_SECRET` hold the same value. If they already
differ, they came from dashboard endpoints and `dev stripe` leaves them
alone.

## Taxes

`dev stripe` reports on Stripe Tax, because checkout can't price an order
without it:

- **inactive/pending** — checkout fails with a tax calculation error. Activate
  Stripe Tax in the sandbox (it needs a head office address).
- **active, no registrations** — checkout works, every order is taxed at 0.
- **active with registrations** — the countries are listed.

To test real tax, add a registration under Tax > Registrations in the sandbox:
pick "I've already registered", then "Non-Union One-Stop Shop (OSS)" for
Ireland, starting immediately. EU countries then get VAT (Ireland 23%,
Sweden 25%, and so on). Tax applies per the customer's billing country, so a
US-only registration leaves EU orders at 0.

## Checkout Email Validation

The checkout form rejects email addresses whose domain looks fake. Two
common gotchas:

- `.local` TLDs fail with "reserved name that cannot be used with email"
- `example.com` fails with "domain does not accept email"

Use a real domain with a `+tag` to keep tests isolated:
`yourname+test-foo@polar.sh`.

## Triggering Dramatiq Actors Manually

Some flows (notably subscription renewals) are driven by background jobs
that normally fire on a schedule. To force one immediately, enqueue the
actor from inside the api container:

```bash
docker exec polar-app-<N>-api-1 sh -c 'cd /app/server && uv run python -c "
import asyncio, dramatiq
import polar.tasks  # registers every actor as a side-effect of import
from polar.worker import JobQueueManager, enqueue_job
from polar.redis import create_redis

async def main():
    redis = create_redis(\"worker\")
    async with JobQueueManager.open(dramatiq.get_broker(), redis):
        enqueue_job(\"<actor.name>\", *args)

asyncio.run(main())
"'
```

Two non-obvious bits:

- `import polar.tasks` is required. Without it, the broker has no registered
  actors and `enqueue_job` raises `dramatiq.errors.ActorNotFound`.
- The `JobQueueManager.open(...)` context manager is what flushes the queued
  message to Redis. Without it, `enqueue_job` raises `LookupError` on the
  `polar.job_queue_manager` context var.

### Useful actors

| Actor | Args | Notes |
|-------|------|-------|
| `subscription.cycle` | `subscription_id, force` | Advances one period. `force=True` ignores `current_period_end` — use it to fake renewals or to drive `cancel_at_period_end` subscriptions to their final cancel. |

## Inspecting the Backoffice

The backoffice is mounted at `http://localhost:<api-port>/backoffice/` and
uses the same session cookie as the dashboard, so logging into the dashboard
also authenticates you here. Useful for verifying merchant-side state
(balance, review status, transactions, audit logs) without writing SQL.

A direct DB cross-check is still cheap and worth running when investigating
balance/transaction issues:

```bash
dev docker exec db psql -U polar -d polar_dev_<N> -c \
  "SELECT total_balance FROM organizations WHERE slug='admin-org';"
```
