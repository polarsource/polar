# Void migration

Void is being moved from `polarsource/void` at
`495330f3f00e157f6cd034562cfecfb55075d517` into Polar. The SDK and CLI live in
`clients/packages/void-sdk`. Its README contains the local login instructions.

## Current stage

Stages 1–5 provide the SDK/CLI, gated Polar organization-token login, isolated
persistence, identity trees, bindings to Polar customers, and event processing.
Live routes are:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/v1/void/organizations/current` | Identify the token's Polar organization |
| GET, POST | `/v1/void/identities` | List identities or create one on first touch |
| GET | `/v1/void/identities/{external_id}` | Read the identity, ancestor chain, and children |
| GET, POST | `/v1/void/customers` | List bound customers or attach a customer to a root |
| GET | `/v1/void/customers/{external_id}` | Read a customer through its root identity key |
| GET, POST | `/v1/void/events` | List delivered events or durably accept a batch |
| GET, POST | `/v1/void/reducers` | List or create reducers, including historical backfill |
| GET | `/v1/void/reducers/{id}` | Read a reducer definition |
| GET | `/v1/void/reducers/{id}/records` | Read first/last dictionary records by actor |
| GET | `/v1/void/metrics` | Read scalar and derived totals or time series |

Configuration deployment, snapshots, subscription lifecycle, and metric comparisons
remain pending. The SDK compatibility contract retains those pending operations.

## Event processing and recovery

`POST /events` accepts up to 1,000 events and returns 202 after PostgreSQL commits
canonical event payloads. `saved` means durably accepted. Tinybird listings and
reducer results become visible asynchronously through the dedicated Void worker.
Event timestamps require a timezone and must fall in 1970–2105, matching the
processing pipes' date range. Actor identities must already exist in the
organization. The server stamps the actor's root when accepting the event.

The `void_events` table reserves each organization's external event IDs. The first
payload wins, including within a batch and across concurrent requests. Retries do
not change attribution, timestamps, or metadata. Rows remain after delivery to
preserve idempotency and support reducer backfills. Retention is not implemented;
do not prune these records without a replacement for those guarantees.

The worker locks pending rows, sends them to Tinybird with synchronous ingestion,
then signals bucket processing. It marks delivery complete only after notification
succeeds. A crash at either boundary leaves the row pending for automatic retry;
the caller does not need to submit the event again. Tinybird uses
`ReplacingMergeTree` with immutable event IDs, and every read uses `FINAL` so
replayed delivery never inflates aggregates while background merges are pending.

Reducer creation queues historical five-minute buckets transactionally. Reducer
writes keep event processing receipts and queue dependent reducers in the same
transaction. Activities serialize writes to a bucket, retry outages, and preserve
signals during debounce. Derived reducers merge their input states before
computing totals, so ratios aggregate correctly across actors and periods.

Void keeps its Temporal worker separate from Polar's Dramatiq worker. Workflow IDs,
schedules, and the default task queue use the `polar-void` prefix. API startup does
not connect to Temporal or build Tinybird resources. Workers process only enabled,
allowlisted organizations. Removing an organization pauses queued computation;
retryable activities retain it until access is restored. Stop the worker when
turning off Void entirely.

## Run the event pipeline locally

From `server/`, alongside the normal Polar database and API infrastructure:

```sh
docker compose -f docker-compose.void.yml up -d
export POLAR_VOID_ENABLED=true
export POLAR_VOID_ORGANIZATION_IDS='["<organization-uuid>"]'
uv run alembic upgrade head
uv run task void_tb_deploy --local
export POLAR_VOID_TINYBIRD_API_TOKEN="$(curl -fsS http://localhost:7281/tokens | jq -r .admin_token)"
uv run task void_worker
```

Start `uv run task api` in another terminal with the same Void environment values.
The dedicated development services use Tinybird port 7281 and Temporal port 7333,
with Temporal's UI on 8333. They have a separate Compose project and volumes.
For custom ports also set `POLAR_VOID_TINYBIRD_API_URL` and
`POLAR_VOID_TEMPORAL_ADDRESS` on the API and worker.

For hosted environments, provision a **dedicated Tinybird workspace**, set
`POLAR_VOID_TINYBIRD_API_URL`, `POLAR_VOID_TINYBIRD_API_TOKEN`, and
`POLAR_VOID_TINYBIRD_WORKSPACE`, then run `uv run task void_tb_deploy` with the
Tinybird CLI installed. The command verifies the workspace and runs build,
deployment check, and deployment. Resources live in `server/void-tinybird` and all
names start with `void_`. Keep this project separate from Polar billing's Tinybird
project; deploying a partial project can remove unrelated resources.

Temporal uses `POLAR_VOID_TEMPORAL_ADDRESS`, `POLAR_VOID_TEMPORAL_NAMESPACE`, and
`POLAR_VOID_TEMPORAL_TASK_QUEUE`. Hosted Temporal also supports
`POLAR_VOID_TEMPORAL_TLS` and `POLAR_VOID_TEMPORAL_API_KEY`. Start one or more
`uv run task void_worker` processes with the same settings. Schedules are created
idempotently when the worker starts. This stage does not run subscription or meter
cycle workflows.

## Identity and customer rules

Identity creation is idempotent. It returns 201 for a new identity and 200 for an
existing one, preserving the first parent and metadata. Parents must already exist
in the same organization. A deleted external ID stays reserved. Tree queries filter
by organization and active records, and terminate if stored data contains a cycle.

A customer owns a root identity. Creating another binding for an already bound
customer or root returns 409. Identity creation and customer binding share an
organization row lock until the request commits. Customer creation uses a savepoint
to roll back both the root and native customer if binding fails.

The adapter uses Polar's customer services and retains their member creation,
events, and webhook jobs. It reuses a native customer with the same external ID.
An optional `customer_id` explicitly identifies an existing Polar customer; an
unset native external ID is established through Polar's update service. A different
existing external ID is a conflict. Customers are never matched by email alone.

The binding stores the Polar customer UUID. Void's response external ID comes from
the immutable root identity, so later native changes do not change the identity key.
Native contact details remain authoritative; response email is required but nullable.
Deleted customers, roots, and bindings are hidden.

Reads require `void:read` or `void:write`; writes require `void:write`. Customer
reads additionally require `customers:read` or `customers:write`, and binding writes
additionally require `customers:write`. Use the local token helper's `--customers`
option to grant those customer permissions explicitly:

```sh
uv run python -m scripts.generate_void_token <organization-uuid-or-slug> --customers
```

## Persistence

Migration `3d19da536d94`, following `38a9961f9d09`, adds twelve tables:

| Tables | Purpose |
| --- | --- |
| `void_organization_settings` | Organization extension for `default_variant_id` |
| `void_billing_identities`, `void_customer_bindings` | Identity trees and bindings to existing Polar customer UUIDs |
| `void_reducers`, `void_reducer_buckets` | Reducer definitions, results, and processing receipts |
| `void_reducer_dependencies`, `void_reducer_jobs` | Derived reducer inputs and transactional outbox |
| `void_meters`, `void_deployments` | Versioned meters and configuration deployment records |
| `void_entitlements`, `void_products`, `void_subscriptions` | Entitlements, immutable product generations, and subscription projections |

Migration `b2c26017068c`, following `3d19da536d94`, adds `void_events` for canonical
event payloads and durable delivery. It changes no existing Polar tables.

Every table has a Polar `organization_id`. Composite foreign keys between Void
records reject cross-organization references. Existing Polar tables are unchanged.
Customer contact details and access tokens remain in Polar's existing tables.

Source generation uniqueness retains PostgreSQL `NULLS NOT DISTINCT`, including
nullable variants and branches. Reducer buckets preserve nullable identity keys
and the processing-receipt index. Monetary columns retain their original decimal
precision. Relationships require explicit eager loading through `lazy="raise"`.

The next stages must enforce these remaining service-level rules:

- Product meter and entitlement UUID arrays must refer to resources in the same
  organization. ORM relationship reads already filter by organization.
- Subscription rows remain Void lifecycle projections, separate from Polar's
  payment-backed subscriptions.

## Deployment and validation

The migration was autogenerated and reviewed to contain only additions to
`void_*` tables. Its upgrade and downgrade use Polar's five-second lock timeout.
Keep schema changes in a separate deployment PR from application behavior, as
required by ADR-0006. The integration branch is a staging branch for this work.
Deploy the schema before enabling code that reads or writes these tables.

From `server/`, against a configured local Polar database:

```sh
uv run alembic upgrade head
uv run alembic check
POLAR_ENV=testing uv run python -m pytest tests/void -q --no-cov
uv run task lint_check
uv run task lint_types
```

Pure domain tests can run without database fixtures:

```sh
uv run python -m pytest tests/void/domain --noconftest -q --no-cov
```

Validation used an isolated PostgreSQL 15 database: upgrade, downgrade, and
re-upgrade preserved identical snapshots of existing Polar schema and sample
account, organization, and customer records. `alembic check` reported no drift.
Tests cover database constraints, typed JSON, decimal precision, shared SDK balance
and mapping fixtures, and configuration-hash parity with the source repository.

Disable runtime access with `POLAR_VOID_ENABLED=false`. A schema downgrade drops
the Void tables and their data; it is not the runtime disable mechanism.
