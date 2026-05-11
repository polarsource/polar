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

## Stripe Webhooks

```bash
dev stripe --listen
# or, for a non-default instance, pass the API port shown by `dev docker up`:
dev stripe --listen --port <api-port>
```

`dev stripe --listen` handles the full setup in one step: installs the
Stripe CLI if missing, logs in, writes `POLAR_STRIPE_SECRET_KEY`,
`POLAR_STRIPE_PUBLISHABLE_KEY`, and `POLAR_STRIPE_WEBHOOK_SECRET` into the
central secrets file, runs `dev/setup-environment` to propagate them, and
then starts `stripe listen` forwarding to both the regular webhook endpoint
and the Stripe Connect endpoint (`/v1/integrations/stripe/webhook` and
`/v1/integrations/stripe/webhook-connect`). Re-running it later just starts
the listener.

`--port` defaults to `8000`. Conductor worktrees and multi-instance setups
land outside the 0–2 base-port table, so always check the port printed by
`dev docker up` rather than computing it.

Leave it running and `stripe listen` will log each event with the API's
2xx response. Missing webhook → confirm the api port matches the
`dev docker up` output.

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
    redis = await create_redis(\"worker\")
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
