# Void

Polar as code, as a prototype inside Polar. A developer declares reducers,
meters, entitlements and products in a config file and pushes it with the CLI;
Polar versions it, serves usage and access checks from it, and lets the
dashboard experiment with pricing on the side. The SDK and CLI live in
`clients/packages/void-sdk`.

## Local development

```sh
dev up --void     # infra incl. Tinybird and Temporal, migrations, seed
dev seed
dev start         # api, worker, web
dev void          # the Void Temporal worker; needed for usage to fold
```

Sign in at http://127.0.0.1:3000 as `void@polar.sh` (login code in the API pane)
and pick `void-development`. It carries a demo dataset: four versions, twelve
customers with agent and service identities, subscriptions on three plans, thirty
days of events and three scenarios. Rebuild it with
`uv run task void_seed_demo -- --reset`. The Void dashboard pages default to
frontend fixtures; switch to live data from the version dropdown.

CLI against the local API, from `clients/`:

```sh
source ../server/.env.void
pnpm --filter @void/sdk void login
pnpm --filter @void/sdk void plan --config /absolute/path/to/void.ts
pnpm --filter @void/sdk void deploy --config /absolute/path/to/void.ts [--activate]
```

`uv run task void_dev smoke` runs the whole stack in isolation and the SDK
acceptance scenario; `void_dev run` keeps that stack up. See `--help` for ports.

## Concepts

The repository is the source of truth. Code pushes a configuration, Polar
records it as a version, exactly one version serves traffic, and scenarios are
scratch space on the side.

- **Configuration**: the deploy body; reducers, meters, entitlements, products.
- **Version**: SHA-256 of the normalized configuration (request flags, definition
  order and decimal spelling excluded). Meter and product rows carry the version
  that declared them, so a subscription knows what it was sold under. The
  dashboard labels versions v1, v2… by creation order.
- **Deployment**: one row per version per organization, storing the
  configuration, with status `draft`, `active` or `archived`. Deploying is
  idempotent. Activating archives the current active deployment and requires an
  organization that may accept payments. Activating an archived deployment is a
  rollback.
- **Scenario**: a named, mutable patch (product price, name, description, meter
  terms, unit amounts) pinned to one deployment. It is the Simulate view's
  sandbox, not lineage: no rows of its own, never serves traffic, does not follow
  the active version. Its resolved configuration is the base with the patch
  applied; promote deploys that as a draft, "Copy configuration" hands it back
  for the repository. Promoting a scenario based on v2 after v3 is active drops
  v3's changes, so the base version is always shown.

**Deploying.** `POST /deploys` reconciles all four definition kinds in one
transaction under the organization lock. `dry_run` returns the plan (`create`,
`replace`, `unchanged`, `orphan` against the active version) without writing;
with a preview window it also reprices the active version's usage at the proposed
unit amounts. Reducers and entitlements are shared across versions by slug;
meters and products get new rows per version. Orphans are reported, never
deleted. Subscriptions can only be sold from the active version; reads take
`version_id` to inspect a draft.

**Identities and customers.** Identities form trees per organization; creation
is idempotent and parents must exist. A Polar customer owns one root identity
(`customers.root_identity_id`); binding reuses a native customer with the same
external id and never matches by email. Children inherit entitlements and are
constrained by parent assignments.

**Events and reducers.** `POST /events` stores up to 1,000 canonical events in
`void_events` and returns 202; the first payload per external id wins. The
worker ships pending rows to Tinybird, then folds five-minute reducer buckets,
marking delivery only after both succeed, so a crash means a retry, not a loss.
Rows stay for idempotency and backfills. Derived reducers merge input states
before computing.

**Subscriptions and cycles.** Subscription writes commit their projection and
lifecycle events together; `rebuild` replays them. A five-minute schedule
settles cycles per organization from Tinybird usage, waiting while accepted
events are undelivered. Rows are Void projections, not Polar's payment-backed
subscriptions; nothing touches Stripe.

## API

All routes are under `/v1/void`, excluded from the public schema, and return 404
unless the organization has `feature_settings.void_enabled`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/organizations/current` | Organization and its active deployment |
| GET, POST | `/identities`, `/identities/{external_id}` | Identity trees; snapshot and entitlements under `/{external_id}/…` |
| GET, POST | `/customers`, `/customers/{external_id}` | Bind a Polar customer to a root; `/state` for reconciliation |
| GET, POST | `/events` | List delivered events, accept a batch |
| GET, POST | `/reducers`, `/reducers/{id}`, `/{id}/records` | Reducer definitions and records |
| GET | `/metrics`, `/metrics/compare` | Totals, series, version comparison |
| GET | `/meters`, `/meters/{id}`, `/{id}/balance`, `/{id}/check` | Meters and limit checks |
| GET, POST | `/entitlements`, `/entitlements/{id}` | Entitlement definitions |
| GET | `/products`, `/products/{id}` | Products, optionally for one version |
| GET, POST | `/deploys`, `/deploys/latest`, `/deploys/{id}`, `/{id}/activate` | Plan, apply, inspect, activate |
| GET, POST | `/subscriptions`, `/{id}`, `/{id}/cycles`, `/{id}/cancel`, `/{id}/revoke`, `/rebuild` | Lifecycle |
| GET, POST, PATCH, DELETE | `/scenarios`, `/scenarios/{id}`, `/{id}/promote`, `/{id}/preview` | Pricing scenarios |

**Auth.** An organization access token with `void:read` or `void:write` acts on
its own organization. A user credential with the same scopes names the
organization in the `Polar-Organization-ID` header; writes need the
`products:manage` permission. Customer reads and binds additionally need
`customers:read` / `customers:write`. Endpoints receive an `AuthzContext` from
`VoidRead` / `VoidWrite` in `polar.void.auth`. Mint a local token with
`uv run python -m scripts.generate_void_token <org> --customers`.

## Operations

Void keeps its own Temporal worker (`uv run task void_worker`), task queue and
schedules prefixed `polar-void`, and its own Tinybird project
(`server/void-tinybird`, resources prefixed `void_`, deployed with
`uv run task void_tb_deploy`). Settings: `POLAR_VOID_TINYBIRD_API_URL`,
`POLAR_VOID_TINYBIRD_API_TOKEN`, `POLAR_VOID_TINYBIRD_WORKSPACE`,
`POLAR_VOID_TEMPORAL_ADDRESS`, `POLAR_VOID_TEMPORAL_NAMESPACE`,
`POLAR_VOID_TEMPORAL_TASK_QUEUE`, plus `_TLS` and `_API_KEY` for hosted Temporal.
Keep the Tinybird workspace separate from Polar billing's.

Roll out migrations, then Tinybird, then API and worker, then set
`void_enabled` per organization. Disable by clearing the flag and stopping the
worker; pause the `polar-void-dispatch-*` schedules to stop queued work. A schema
downgrade drops the `void_*` tables and is not a disable mechanism.

All Void tables carry `organization_id`; composite foreign keys reject
cross-organization references. Meters and products are unique by
`(organization_id, slug, version_id)`; a partial unique index keeps one active
deployment per organization. `customers.root_identity_id` is the only change to
an existing Polar table.

Tests: `POLAR_ENV=testing uv run python -m pytest tests/void -n 6`.
`.github/workflows/test_void.yaml` runs them with the SDK tests, OpenAPI parity
and the smoke scenario.
