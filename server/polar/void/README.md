# Void migration

Void is being moved from `polarsource/void` at
`495330f3f00e157f6cd034562cfecfb55075d517` into Polar. The SDK and CLI live in
`clients/packages/void-sdk`. Its README contains the local login instructions.

## Local development with Polar

Start Docker Desktop. From the repo root:

```sh
dev up --void
dev seed
dev start
```

Sign in at http://127.0.0.1:3000 with `void@polar.sh`. Get the login code from
the API pane. Select the empty `void-development` organization.

See [SDK login, ports, and shutdown](../../../dev/cli/README.md#void-development).

## Standalone development and smoke test

Prerequisites: Docker with Compose v2, uv with Python 3.14, Node.js 24, and the
pnpm version declared in `clients/package.json`. Run from this Polar checkout;
the original Void repository and frontend applications are not needed.

```sh
# Install backend and SDK dependencies, without building the frontend workspace.
cd server
uv sync --frozen
cd ../clients
pnpm install --frozen-lockfile --ignore-scripts --filter @void/sdk... --filter polar
cd ../server

# Start real services, run the CLI/SDK acceptance scenario, then stop services.
uv run task void_dev smoke

# Keep the API and Void worker running for development. Ctrl-C stops them.
uv run task void_dev run
```

The runner builds Polar's backend email renderer on first use if it is missing.
It generates a private JWKS, migrates its own database, seeds the
`void-development` organization, deploys the Void Tinybird resources, and starts
the normal Polar API and dedicated Temporal worker. It reads no existing `.env`
file or frontend configuration. Logs and development credentials live in the
ignored `server/.void-dev/` directory. The environment file has mode 0600 and its
token expires after 24 hours; running the setup again refreshes it.

Default ports are API 8010, PostgreSQL 5544, Redis 6384, Minio 9180, Tinybird 7281,
Temporal 7333, and Temporal UI 8333. All are bound to localhost. Use flags such as
`--api-port 8011 --postgres-port 5545` to change them. `--state-dir /path/to/empty-dir`
creates a separate Docker project and data volumes. The runner rejects a
nonempty directory that it did not create.

While `void_dev run` is running, use another terminal from `clients/`:

```sh
source ../server/.void-dev/environment.env
pnpm --filter @void/sdk void login
pnpm --filter @void/sdk void plan --config scripts/smoke.config.ts
pnpm --filter @void/sdk smoke
```

The smoke script uses a temporary credential file and unique customer/event IDs.
It verifies headless login, planning without definition writes, repeated deploys,
customer/root/child binding, usage reduction, inherited entitlements and limits,
offline reconciliation, prepaid credits, a billing boundary, price preview, and
cancel/revoke behavior. The runner triggers the meter schedule at the scenario's
billing checkpoint; a smoke script run on its own waits for the normal five-minute
schedule. Ordinary Polar background jobs remain queued in the isolated Redis;
this workflow runs the Void worker and exercises no external payment integrations.

Shutdown preserves this setup's database and event history so repeated runs can
exercise the same installation. To remove its development data explicitly:

```sh
# Stop the running command with Ctrl-C first.
uv run task void_dev down --remove-volumes
```

To seed an existing local Polar database instead, use its usual development
configuration and run:

```sh
uv run task void_seed --output /tmp/void-local.env --api-url http://127.0.0.1:8000
source /tmp/void-local.env
```

The seed reuses its dedicated organization and account and refuses conflicting
records. It enables `feature_settings["void_enabled"]` on its dedicated organization. Start the API and worker with the resulting environment settings. It never
creates a native paid subscription or configures Stripe.

## Continuous integration

`.github/workflows/test_void.yaml` runs for changes to the backend, Void SDK, or
shared client tooling. It checks backend types/lint, Void and native customer,
event, meter, subscription and authentication tests, SDK/CLI tests and types,
exact OpenAPI parity, deterministic generation, and the live smoke command above.
The migration job upgrades and downgrades the isolated Void revisions while
checking that downgrade restores the existing Polar schema, then upgrades to head
and checks for drift.
CI supplies an email-renderer placeholder because the smoke scenario renders no
email. Normal development uses the real backend renderer.

## Deployment and disablement

Deploy database migrations first, then the dedicated Tinybird project, then
compatible API and worker binaries. Finally enable Void for the chosen
organizations using `organizations.feature_settings["void_enabled"] = true` in the database. Existing environment allowlists are no longer used; set the database flags before deploying this change. Keep its Tinybird workspace separate from Polar billing.
To disable it, clear the organizations’ `void_enabled` feature flags and stop the dedicated
Void workers. Also pause the `polar-void-dispatch-events`,
`polar-void-dispatch-reducers`, and `polar-void-dispatch-meter-cycles` schedules in
Temporal. Resuming the worker preserves durable events and queued computation.
Use the configured task queue prefix if it differs from `polar-void`.

## Current stage

Stages 1–8 provide the SDK/CLI, gated Polar organization-token login, isolated
persistence, identity trees, bindings to Polar customers, event processing, configuration deployment, and the complete backend runtime.
Live routes are:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/v1/void/organizations/current` | Read the organization and its active deployment |
| GET, POST | `/v1/void/identities` | List identities or create one on first touch |
| GET | `/v1/void/identities/{external_id}` | Read the identity, ancestor chain, and children |
| GET, POST | `/v1/void/customers` | List bound customers or attach a customer to a root |
| GET | `/v1/void/customers/{external_id}` | Read a customer through its root identity key |
| GET, POST | `/v1/void/events` | List delivered events or durably accept a batch |
| GET, POST | `/v1/void/reducers` | List or create reducers, including historical backfill |
| GET | `/v1/void/reducers/{id}` | Read a reducer definition |
| GET | `/v1/void/reducers/{id}/records` | Read first/last dictionary records by actor |
| GET | `/v1/void/metrics` | Read scalar and derived totals or time series |
| GET | `/v1/void/meters` | Read meter definitions across versions |
| GET | `/v1/void/meters/{id}` | Read a meter |
| GET, POST | `/v1/void/entitlements` | Read or upsert entitlement definitions |
| GET | `/v1/void/entitlements/{id}` | Read an entitlement definition |
| GET | `/v1/void/products` | Read immutable products, optionally for one version |
| GET | `/v1/void/products/{id}` | Read a product |
| GET, POST | `/v1/void/deploys` | List deployments, or plan or apply a complete compiled configuration |
| GET | `/v1/void/deploys/latest` | Read the active deployment, or one version's deployment |
| GET | `/v1/void/deploys/{id}` | Read a deployment |
| POST | `/v1/void/deploys/{id}/activate` | Make a deployment active; archives the previous one |
| GET | `/v1/void/identities/{external_id}/snapshot` | Identity, customer, balances, and inherited entitlements |
| GET, PUT | `/v1/void/identities/{external_id}/entitlements` | Read access or replace an assignment |
| GET | `/v1/void/customers/{external_id}/state` | Customer reconciliation snapshot and processing receipts |
| GET | `/v1/void/meters/{id}/balance`, `/check` | Fold credits and recurring usage, then check limits |
| GET, POST | `/v1/void/subscriptions` | Read subscriptions or subscribe a root to a product of the active version |
| GET | `/v1/void/subscriptions/{id}`, `/{id}/cycles` | Read a subscription and its closed periods |
| POST | `/v1/void/subscriptions/{id}/cancel`, `/{id}/revoke` | End access at a boundary or immediately |
| POST | `/v1/void/subscriptions/rebuild` | Rebuild projections from durable lifecycle events |
| GET | `/v1/void/metrics/compare` | Compare versions against the same historical customer cohort |

All 40 migrated operations are included in the private OpenAPI export.

## Configuration deployment

The repository is the source of truth. Code pushes a configuration, Polar
records it as a version, exactly one version serves traffic, and scenarios are
scratch space on the side.

- **Configuration**: the deploy body, a declaration of reducers, meters,
  entitlements and products. Credentials select the organization.
- **Version**: the SHA-256 hash of the normalized configuration. It excludes the
  SDK checksum, dry-run flag, preview window and activate flag; definition order
  and equivalent decimal spellings do not change it. Same configuration, same
  version, anywhere. Every meter and product row carries the version that
  declared it, so a subscription always knows which configuration it was sold
  under. The dashboard labels versions v1, v2… by creation order.
- **Deployment**: one row per version per organization, holding the normalized
  configuration and a status of `draft`, `active` or `archived`. Deploying is
  idempotent: pushing an existing version returns its deployment. Activation is
  the only state change; it archives the current active deployment and requires
  an organization that may accept payments. Deployments are what serve traffic.
- **Scenario**: a named, mutable patch (product price, name, description,
  meter terms, meter unit amounts, keyed by slug) pinned to one deployment. It
  is a pricing sandbox for the dashboard's Simulate view, not part of the
  version history: it has no meter or product rows, never serves traffic, does
  not follow the active version and is not listed with deployments. On read the
  patch is applied to the base configuration, giving the resolved configuration
  and the version it would become. Simulation assumptions stay in the browser.

A scenario leaves the sandbox two ways. `POST /scenarios/{id}/promote` runs the
ordinary deploy on the resolved configuration and records the resulting draft.
The dashboard's "Copy configuration" hands back the resolved configuration to
commit to the repository, so the next real push produces the same version. A
scenario stays pinned to its base: promoting one based on v2 after v3 activated
yields a configuration without v3's changes, which is why the base version is
shown. `POST /scenarios/{id}/preview` reprices the base version's usage under
the patch. Scenarios persist until deleted.

`POST /deploys` reconciles reducers, meters, entitlements and products together.
Both planning and applying require `void:write`. `dry_run: true` validates and
returns the plan without writing definitions, deployment records or backfill
jobs. Historical price previews require `dry_run`, customer-read scope, and
Tinybird access. They reprice the active version's usage at the proposed unit
amounts, preserving credits and rollover. Unsupported histories and currency or
reducer changes are reported explicitly.

Applying uses one transaction and the organization lock shared by definition
writes and activation. A failed apply rolls back every definition and queued
backfill. Reducers and entitlements are unique by slug and shared across
versions. Meters and products belong to the version that declared them; a new
version gets its own rows even for unchanged definitions. Pushing a version that
already has a deployment returns that deployment and writes nothing. Plan
entries (`create`, `replace`, `unchanged`, `orphan`) compare the pushed
configuration with the active version. Orphans are reported, never deleted;
subscriptions keep the product row they were sold under. Deleted reducer and
entitlement slugs stay reserved during both planning and applying.

A new deployment is a draft until activated. `activate: true` on the deploy
body activates it in the same transaction; `POST /deploys/{id}/activate`
activates an existing draft or archived deployment (activating an archived one
is how a rollback works). Subscriptions can only be created for products of the
active version. Customer state, identity snapshots and `GET /deploys/latest`
follow the active version unless `version_id` names another deployed version,
which is how a draft is tested before activation.

After logging in, run these commands from `clients/`:

```sh
pnpm --filter @void/sdk void plan --config /absolute/path/to/void.ts
pnpm --filter @void/sdk void deploy --config /absolute/path/to/void.ts
```

Plain `plan` checks configuration only. `--preview` or explicit `--from` / `--to`
dates request historical price comparisons against the active version.
`void deploy --activate` applies and activates in one step; `void activate --id
<deployment>` activates a deployment later.
A complete example used by the CLI tests lives in
`clients/packages/void-sdk/test/fixtures/deployment.ts`.

Definition deployment needs only Polar's API and PostgreSQL. Applying a new
reducer queues backfill work for the Void worker; starting Temporal or Tinybird is
not required to plan or apply definitions.

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
not connect to Temporal or build Tinybird resources. Workers query the database for organizations with `feature_settings["void_enabled"]` set to `true` and permission to authenticate. Disabling the flag pauses new API requests and queued computation without a worker restart. Already-running work may finish;
retryable activities retain it until access is restored. Stop the worker when
turning off Void entirely.

## Run the event pipeline locally

From `server/`, alongside the normal Polar database and API infrastructure:

```sh
docker compose up -d tinybird temporal
# Enable organizations.feature_settings["void_enabled"] in the database first.
uv run alembic upgrade head
uv run task void_tb_deploy --local --shared
export POLAR_VOID_TINYBIRD_API_TOKEN="$(curl -fsS http://localhost:7181/tokens | jq -r .admin_token)"
uv run task void_worker
```

Start `uv run task api` in another terminal with the same Void environment values.
Local development shares Polar's Tinybird on port 7181. Temporal uses port 7233,
with its UI on 8233, in the same Compose project as Polar's other services. From the repo root,
`dev up --void` configures these services and `dev void` launches the Void worker.
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
idempotently when the worker starts, including meter-cycle processing.

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

The nullable, unique `customers.root_identity_id` references the root identity.
Only the Void customer endpoint creates or assigns it; ordinary Polar customer
creation leaves it null. Existing customers are not backfilled. A composite foreign
key requires the root to belong to the customer's organization, and the service
requires it to have no parent. Identities have no customer reference; reverse
lookups query `customers.root_identity_id`.

Void's response external ID comes from
the immutable root identity, so later native changes do not change the identity key.
Native contact details remain authoritative; response email is required but nullable.
Deleted customers and roots are hidden.

Reads require `void:read` or `void:write`; writes require `void:write`. Customer
reads additionally require `customers:read` or `customers:write`, and binding writes
additionally require `customers:write`. Use the local token helper's `--customers`
option to grant those customer permissions explicitly:

```sh
uv run python -m scripts.generate_void_token <organization-uuid-or-slug> --customers
```

## Lifecycle and reconciliation

Subscription writes hold the organization lock and commit their projection and
canonical lifecycle events together. Rebuild reads system lifecycle events from
PostgreSQL, including events not yet delivered to Tinybird. Direct user
`subscription.*` meter events remain supported; they do not create product
subscription projections. Entitlement assignments use a managed last-value reducer
and become effective after processing. Parent assignments constrain children.

Customer state and identity snapshots open a fresh `REPEATABLE READ` transaction
on the primary database. They never use the read replica. Snapshots retain
per-event processing receipts and the requested replay window so SDK local events
can reconcile with server totals. Snapshot, state, and comparison responses that
include customer details require customer-read permission in addition to Void read.

The dedicated worker registers a namespaced meter-cycle schedule every five
minutes. Each organization settles in its own transaction. Settlement waits while
accepted events remain undelivered, then reads authoritative Tinybird usage so a
lagging PostgreSQL reducer cannot freeze a stale charge. Cycle IDs are deterministic
and retries keep the first accepted event. Source behavior for already settled
periods is retained; this migration does not add retroactive adjustments or a
native Polar billing writer. The source active-subscription schedule also excludes
ended subscriptions; their historical cycles remain available through cycle reads.

## Persistence

Migration `3d19da536d94`, following `38a9961f9d09`, adds ten tables and the nullable `customers.root_identity_id` reference:

| Tables | Purpose |
| --- | --- |
| `void_identities` | Identity trees owned through `customers.root_identity_id` |
| `void_reducers`, `void_reducer_buckets` | Reducer definitions, results, and processing receipts |
| `void_reducer_dependencies`, `void_reducer_jobs` | Derived reducer inputs and transactional outbox |
| `void_meters`, `void_deployments` | Meters per version and deployment records with status |
| `void_entitlements`, `void_products`, `void_subscriptions` | Entitlements, immutable products per version, and subscription projections |

Migration `b2c26017068c`, following `3d19da536d94`, adds `void_events` for canonical
event payloads and durable delivery. It changes no existing Polar tables.

Every table has a Polar `organization_id`. Composite foreign keys between Void
records reject cross-organization references. The customer root reference is the
only change to an existing Polar table.
Customer contact details and access tokens remain in Polar's existing tables.

Meters and products are unique by `(organization_id, slug, version_id)`, and a
partial unique index keeps one active deployment per organization. Reducer
buckets preserve nullable identity keys and the processing-receipt index. Monetary columns retain their original decimal
precision. Relationships require explicit eager loading through `lazy="raise"`.

Product meter and entitlement UUID arrays are validated against active resources
in the same organization. ORM relationship reads also enforce organization scope.

### Authentication

Every `/v1/void` route accepts two kinds of credentials. An organization access
token with `void:read` or `void:write` acts on its own organization. A user
credential (dashboard session, personal access token, or OAuth2 user token) with
the same scopes names the organization with the `Polar-Organization-ID` header;
the user must be a member of that organization, and writes additionally require
the `products:manage` role permission. Both paths return 404 unless the
organization has `void_enabled` set. Endpoints receive Polar's `AuthzContext`
from the `VoidRead` and `VoidWrite` dependencies in `polar.void.auth`, carrying the
resolved organization and the auth subject.
Subscription rows remain Void lifecycle projections, separate from Polar's
payment-backed subscriptions. No native purchase or Stripe lifecycle adapter is installed.

## Deployment and validation

The migration was autogenerated and reviewed to add `void_*` tables and the
customer root reference. Its upgrade and downgrade use Polar's five-second lock
timeout. The initial branch migration has been revised, so databases already on its
previous version need rebuilding or a separate data-preserving upgrade before
running this code.
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

Step 7 was also exercised through a running Polar API, the actual SDK/CLI, and
isolated PostgreSQL, Tinybird, and Temporal services. The scenario created a root,
child, and customer binding, subscribed to a deployed product, enforced a child
usage cap, and reconciled offline usage after its server receipt without double
counting. A closed period produced 200 overage units and a $49.40 cycle total;
a historical preview at the proposed rate produced $0.80 for the same 200 units.
The normal Polar API client regenerated without changes, and Alembic found no
schema drift.

Disable runtime access by clearing the organization’s `void_enabled` feature flag. A schema downgrade drops
the Void tables and their data; it is not the runtime disable mechanism.
