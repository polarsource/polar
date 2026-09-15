# Void SDK

## Migration status

This private package contains the SDK and CLI imported from
[`polarsource/void` at `495330f3`](https://github.com/polarsource/void/tree/495330f3f00e157f6cd034562cfecfb55075d517/packages/sdk).
It keeps the `@void/sdk` imports and the `void` command.

Polar serves the backend runtime under `/v1/void`, including subscriptions,
entitlement assignments, balances, identity snapshots, customer reconciliation,
and historical price comparisons. The SDK sends a Polar organization access token,
`Polar-Version: 2026-04`, and `x-void-config` with requests. Set `apiUrl` to the server
origin, without `/v1/void`.

The checked-in contract contains all 40 migrated operations. Organization access
comes from the Polar token; the old Void organization creation and listing APIs
are not exposed. Void subscriptions remain separate from Polar's payment-backed
subscriptions.

Event ingestion returns `202` after durable acceptance. The dedicated Void worker
delivers events and recomputes reducers, so event listings and metrics update
asynchronously. Run the worker and its Temporal/Tinybird services as described in
[`server/polar/void/README.md`](../../../server/polar/void/README.md).

### Run the full stack

Start Docker Desktop. From the repo root:

```sh
dev up --void
dev seed
dev start
```

For SDK login, open another terminal from the repo root:

```sh
cd clients
source ../server/.env.void
pnpm --filter @void/sdk void login
```

Rerun setup and source the file again to refresh the 24-hour token.
Use the [isolated smoke-test runner](../../../server/polar/void/README.md#standalone-development-and-smoke-test)
to keep this organization empty.

See [dashboard login, ports, and shutdown](../../../dev/cli/README.md#void-development).

### Try login locally

Use a local Polar database with an existing organization. Start the server from
`server/` with the Void route enabled for that organization:

```sh
uv run task api
```

Enable the organization in the Polar database:

```sql
UPDATE organizations
SET feature_settings = feature_settings || '{"void_enabled": true}'::jsonb
WHERE id = '<organization-uuid>';
```

This uses the existing organization feature settings. No migration or frontend change is required. Set the value to `false` to pause that organization's Void API access and queued processing. Already-running work may finish. `POLAR_VOID_ORGANIZATION_IDS` is no longer used; enable previously allowlisted organizations in the database before deploying this change.

In another terminal from `server/`, set the same environment variables and create
a development token:

```sh
uv run python -m scripts.generate_void_token <organization-uuid-or-slug>
```

The helper creates a token that expires after 24 hours and is limited to local
development and testing. Login requires an organization access token with either
`void:read` or `void:write`. The organization must also have its `void_enabled` feature flag set; enabling
the route alone grants no access.

From `clients/`, run:

```sh
pnpm --filter @void/sdk void login --api-url http://127.0.0.1:8000
# Paste the token into the masked prompt.
pnpm --filter @void/sdk void logout
```

### Connect identities and Polar customers

Identity reads require `void:read` or `void:write`. Creating an identity requires
`void:write`. Customer reads also require `customers:read` or `customers:write`;
creating a customer binding requires both `void:write` and `customers:write`.
`actor.customer()` uses both identity and customer reads.

To include customer access in a local development token, add `--customers`:

```sh
uv run python -m scripts.generate_void_token <organization-uuid-or-slug> --customers
```

```ts
// Supply a real billing email when creating a new customer.
const account = await client.root('acme')
const member = await account.spawn('alice')

await client.api.customers.create({
  external_id: account.id,
  email: billingEmail,
  name: 'Acme',
})

await member.chain() // ['alice', 'acme']
await member.customer() // the Polar customer bound to acme
```

A binding connects a root identity to a native Polar customer in the authenticated
organization. An existing native customer with the same `external_id` is reused.
To bind a customer that has no external ID, pass its UUID as `customer_id` alongside
`external_id` and `email`. Customers with a different external ID cannot be rebound.
The response `id` is the native Polar customer UUID. Creating a binding for an
already bound identity or customer returns 409; use `customers.get()` to read it.

Existing native names and emails are authoritative, including absent values.
Supplied contact fields apply only when creating a new native customer. The
response email is nullable because Polar customers can have no email.
Identities keep the parent assigned on first creation. Customer bindings require a
root identity, and the server keeps each binding within the token's organization.

From the Polar `clients/` directory:

```sh
pnpm install
pnpm --filter @void/sdk test
pnpm --filter @void/sdk typecheck
pnpm --filter @void/sdk lint
pnpm --filter @void/sdk format:check
pnpm --filter @void/sdk void --help
pnpm --filter @void/sdk generate
```

`generate` uses the checked-in `openapi.json` and requires no running server or
Python environment. Refresh it from Polar's private API export:

```sh
# From server/
uv run python -m scripts.generate_void_openapi 2026-04 > /tmp/void-openapi.json
# From clients/
pnpm --filter @void/sdk generate /tmp/void-openapi.json
```

The default test suite runs without services. PostgreSQL and Redis integration
tests skip unless their test connection variables are set. The shared backend
parity fixtures are copied into `test/fixtures/` so tests run within this checkout.
The package exports TypeScript source and has no separate build step; its CLI
loads that source through `tsx`.

## SDK usage

Define local meter thresholds with `signal` and react to reconciled usage in your
SDK client. See
[customer signals](./docs/signals.md) for `.get()`, `.listen()`, and setup.

Define events, reducers, and meters with `@void/sdk/config`, then pass the config to `createVoid`. The Promise client uses `as(id)` for an existing identity and `root(id)` or `ensure(id, { parent })` to create one idempotently. Effect is an internal implementation detail; the public runtime interface returns Promises.

## Config and authentication

The config describes the events, reducers, and meters to deploy. Credentials determine which organization receives that setup. The CLI deploys the config, and the application uses the same config with `createVoid`.

```ts
import { defineConfig } from '@void/sdk/config'
import * as schema from './schema'

export const config = defineConfig({ schema })
```

Config contains no Void organization ID, API token, or server URL. The same config can be used for different organizations by supplying different credentials. Its compiled contents and checksum describe the setup independently of the target organization. Optional event storage connections are runtime-only and are excluded from deployment payloads and checksums.

### CLI login and deployment

```sh
void login --profile development --api-url http://localhost:8000
# Paste an existing organization access token into the masked prompt.
void profiles
void whoami
void switch development
void plan --profile development
void deploy --profile development
void logout --profile development
```

`void login` stays in the terminal. It validates the token with `GET /v1/void/organizations/current`, displays the organization and server, and saves a named profile. It does not create an account or issue a token. Without `--profile`, the name defaults to `<organization-slug>@<server-host>`. Logging in activates the profile. An existing profile can receive a replacement token for the same organization and server; a different target requires a different name.

Supply `--token` or `VOID_TOKEN` for noninteractive login. Otherwise, login uses a masked token prompt. The server URL comes from `--api-url`, `VOID_API_URL`, the named or active saved profile, or an interactive prompt. For local Polar development, use the token helper above.

`void profiles` lists saved organizations and marks the active profile. `void switch <profile>` validates its token before changing the active profile; without a name, it offers an interactive selection. `void whoami` verifies and displays the current organization, UUID, server, and saved profile when applicable. It needs no config file.

`void plan` and `void deploy` revalidate credentials and display the target before sending a deployment request. A revoked token or a mismatch between the token's organization and its saved profile stops the command. Config files contain no organization target.

Without `--profile`, credential precedence remains **flags → environment variables → active profile**. A saved token is used only for its saved server URL. Explicit `--profile` selects saved credentials and rejects `--api-url`, `--token`, `VOID_API_URL`, or `VOID_TOKEN` overrides. CI can supply its own server URL and secret token without any saved profiles. Switching profiles warns when environment credentials would override the selection.

Profiles are stored at `$XDG_CONFIG_HOME/void/credentials.json`, or `~/.config/void/credentials.json` when unset. `VOID_CREDENTIALS_FILE` overrides this path. Tokens are plaintext in an atomically replaced file with mode `0600`; newly created directories use mode `0700`. Existing single-login files are read as a profile named `default` and converted when next saved. Failed authentication preserves saved profiles.

`void logout` removes the active profile, `void logout --profile <name>` removes one profile, and `void logout --all` removes the file. Removing the active profile leaves no active selection; it does not silently select another organization. Logout does not revoke tokens or change environment variables.

Applications provide their own credentials to `createVoid`:

```ts
import { createVoid } from '@void/sdk'
import { config } from './void'

const client = createVoid(config, {
  apiUrl: process.env.VOID_API_URL!,
  token: process.env.VOID_TOKEN!,
})

await client.api.customers.get(customerId)
await client.as(customerId).meters.tokens.check({ estimate: 100 })
```

Organization operations under `client.api` and identity operations under `client.as(id)` use the same credentials. `createVoid` is the public client entry point.

Applications supply their own runtime token. The SDK does not read a developer's saved CLI login.

## Configuration deployment

`void plan` compares reducers, meters, entitlements and products without writing.
`void deploy` applies the complete configuration atomically and reports its content
hash as `version`. Repeating the same deployment reuses existing definitions.
Orphaned definitions are reported and retained.

Deploying a version does not select it as the organization's default. Select a
deployed version explicitly through the SDK:

```ts
// Use the version hash printed by `void deploy`.
await client.api.organizations.updateCurrent({
  default_version_id: deployedVersion,
})
const deployment = await client.api.deploys.latest()
```

The default is stored in Void organization settings. It does not alter native
Polar product or subscription configuration.

### Historical price previews

Planning defaults to configuration changes only. Add `--preview` or a date
window to compare processed usage at the proposed meter prices. Preview reads
require customer-read permission and configured Tinybird access. They write no
billing or deployment records. Currency or reducer changes and unsupported
subscription histories are reported explicitly rather than priced as zero.

```sh
void plan
void plan --preview
void plan --from 2026-08-01 --to 2026-09-01
```

Customer state and identity snapshots use a fresh transaction on Polar's primary
database at repeatable-read isolation. The SDK uses processing receipts to merge
locally buffered events with server balances without counting usage twice.

## Runtime usage

Event metadata uses ordinary TypeScript types, without a schema-library dependency:

```ts
export const creditsPurchased = event<{
  amount: number
  pack: string
  price_cents: number
}>('credits.purchased')
```

Metadata types are erased at runtime. Reads trust those declarations and preserve historical data, including fields that differ from today's type. The SDK still validates HTTP response structure. The API validates request structure and deployment validates reducer and meter configuration; neither enforces custom TypeScript metadata fields. Compiled events contain names only, and changing a metadata type does not change the deployment checksum.

```ts
const actor = client.as(customerId)
await actor.events.creditsPurchased.record({
  amount: 100,
  pack: 'starter',
  price_cents: 1000,
})
const purchases = await actor.events.creditsPurchased.list({ limit: 100 })
const customer = await actor.customer()
const snapshot = await actor.snapshot()
const spent = await actor.reducers.spent.total()
await actor.meters.tokens.check({ estimate: 500 })
snapshot.meters.tokens.remaining
```

Properties use schema export names, so `creditsPurchased` stays distinct from its event name, `credits.purchased`. Only exported definitions appear. Events provide `record` and `list`; scalar reducers provide `total` and `usage`; record reducers provide `latest`. Meters provide `check`, `balance`, `total`, and `usage` for their reducer, including inline reducers. `snapshot` reads the identity, root customer, and current mainline meter balances at one server timestamp. Identity methods such as `spawn`, `parent`, and `children` remain on the actor.

This replaces the Promise client's direct verbs such as `actor.record(event, data)` and `actor.total(reducer)`.

Child entitlements can narrow inherited feature access and cap usage on existing meters. One term at a time, keeping the rest:

```ts
await actor.cap(credits, 100) // null lifts it
await actor.deny(priority)
await actor.allow(priority)
```

Or all terms at once, replacing what was there. Omitted lists inherit; empty lists deny. A child can start with its terms:

```ts
await actor.setEntitlements({ meters: [{ meter: credits, cap: 100 }] })
const child = await actor.spawn('nightly', {
  entitlements: { features: [], meters: [{ meter: credits, cap: 20 }] },
})
```

While an identity still inherits everything, `cap` and `deny` first spell out the config's full meter or feature list, so editing one term denies none of the others.

Assignments use the existing last-record reducer and become effective after processing. Caps follow the root meter period and reserve no credits.

Meters can use prepaid credits without a subscription. Connect an existing named
sum reducer with `creditReducer`; config deployment preserves that reducer and
its buckets. When omitted, deployment creates a reducer for `credit.granted`
events matching the meter slug.

```ts
export const purchased = sum('credits_purchased', creditsPurchased, 'amount')
export const spent = sum('credits_spent', generatePrompt, 'credits')
export const credits = meter('builder_credits', {
  reducer: spent,
  creditReducer: purchased,
  price: { amount: 0 }, // prepaid packs; no overage price
})

const result = await client
  .as(customerId)
  .meters.credits.check({ estimate: 10 })
if (!result.allowed) throw new Error('Insufficient credits')
```

Checks compare the estimate against every credit or subscription holder from the
actor to its root. Each holder's own credits cover usage throughout its subtree.
A holder with an exhausted or zero credit bucket still imposes a limit; actors
without credits or subscriptions inherit their ancestors' limits. No holder
means denial. Results include `allowed`, `remaining`, `limitedBy`, and `reason`:
`ok`, `cap`, or `no_plan` (the latter means no credit/subscription holder).
`remaining` is the balance before the proposed action. Checks do not reserve or
spend credits; record usage after the action. Reducer processing is asynchronous,
so concurrent requests can overspend before usage reaches the balance.

Subscription setup still requires billing data provisioned on the server.
Deploy the updated server before deploying configs that specify `creditReducer`.

### Organization operations

Organization operations are grouped by resource and accept snake_case inputs directly:

```ts
await client.api.customers.create({
  external_id: customerId,
  email: 'hello@example.com',
  name: 'Alex',
})
await client.api.events.list({ external_root_id: customerId, limit: 100 })
await client.api.identities.get(customerId)
```

The groups are `organizations`, `identities`, `customers`, `events`, `reducers`, `meters`, `metrics`, and `deploys`. These replace flat methods such as `api.customersCreate({ payload: ... })`. Inputs and responses use the HTTP API's field names and generated types, and metadata keys are preserved exactly.

Named reducers keep their own keys when attached to a meter. Inline reducers receive the meter's key without changing the original definition. Configs collect shared named reducers once.

Identity context belongs to each client. `actor.run()` supplies `current()` and the default `ensure()` parent only on the client that created the actor. Nested runs restore the previous identity, and concurrent runs stay isolated. Pass an explicit parent or use `root()` outside a run. Middleware uses this same per-client context and forwards resolver errors to `next(error)`.

SDK failures use the exported error classes: `VoidError` for local or transport failures, `VoidHttpError` for HTTP failures, and `MalformedResponse` for invalid response structures. Missing context in `current()`, `from()`, and `ensure()` uses `VoidError` with `reason: 'no_scope'`. Promise rejections retain the error instance and fields. Errors thrown by your `run()` callback or middleware resolver are passed through unchanged.

Scope objects are lightweight handles. Repeated lookups can return different objects for the same identity; compare their `id` fields. Navigation methods return handles with the same Promise methods, `run`, and `headers`.

Resolver listings are shared across concurrent lookups and cached for one minute. Failed listings expire immediately so the next lookup retries.

## Additional event storage

Supply one or more typed SQLite connection objects in `eventStorage`. This adapter
uses Node's built-in `node:sqlite` `DatabaseSync` (Node 22.5 or later). The application
owns the connection and closes it after disposing its Void clients.

```ts
import { DatabaseSync } from 'node:sqlite'
import { defineConfig } from '@void/sdk/config'
import * as schema from './schema'

const database = new DatabaseSync('data/app.db')
export const config = defineConfig({
  schema,
  eventStorage: [{ type: 'sqlite', connection: database }],
})
```

Both `actor.events.<export>.record()` and `client.api.events.ingest()` commit
all events to every configured destination before posting them to the Void API.
The SDK resolves the authenticated organization on the first nonempty ingestion
and caches its ID. A new client therefore needs API access to identify its organization
before its first local write. It creates its schema lazily and wraps schema creation and event batches in
SQLite transactions. An open application transaction is rejected without changing
or rolling back that transaction, so the API cannot receive uncommitted events.
SQLite writes are synchronous and briefly block the calling thread.

Storage is runtime-only: compilation, planning, and deployment neither create
tables nor include connections in deployment payloads or checksums. Your config
module still opens the application connection when it constructs `DatabaseSync`.
You can create the tables explicitly at startup with
`initializeSQLiteEventStorage(database)` from `@void/sdk`; the SQL is also
exported as `sqliteEventStorageSchema` for provisioning.

The SDK owns the strict table `polar_void_events` and its `polar_void_events_*` indexes:

| Column                 | SQLite type      | Meaning                                  |
| ---------------------- | ---------------- | ---------------------------------------- |
| `organization_id`      | `TEXT`           | Authenticated Void organization          |
| `external_id`          | `TEXT`           | Caller event ID or SDK-generated UUID    |
| `name`                 | `TEXT`           | Event name                               |
| `external_identity_id` | `TEXT`, nullable | Actor ID supplied with the event         |
| `timestamp`            | `TEXT`           | Event time as a UTC ISO timestamp        |
| `metadata`             | `TEXT`           | JSON metadata, defaulting to `{}`        |
| `recorded_at`          | `TEXT`           | UTC ISO time inserted into this database |

The primary key is `(organization_id, external_id)`. `StoredEvent` exports the
typed envelope with decoded JSON metadata. Root identity attribution remains
server-owned and is not guessed locally. You can use the application's existing
database; the SDK's table names keep them separate from application tables.

Each database commits an entire batch atomically. All destinations must succeed;
a failure rejects with `VoidError`, `reason: 'event_storage'`, without posting
events. Earlier successful writes remain if another destination or the API fails.
Retry with the same IDs: the first destination's original payload and timestamp
are reused, including when a caller supplies different data for an existing ID.
Conflicting copies already stored in subsequent destinations block ingestion.
Without an explicit ID, another `record()` call creates a new event.

Event storage is a buffer, not an archive. The server is the source of truth,
and a local event only matters until the server has counted it. Three rules keep
the buffer small and the values exact:

- A check that sees a server receipt for a local event deletes that event from
  every store. Nothing is deleted on a guess. The delete runs in the background
  and never delays or fails the check; a store that cannot delete, such as a
  read-only replica, is tolerated. `client.flush()` waits for this work, and
  `client.dispose()` flushes first. On serverless platforms, pass it to the
  after-response hook, for example `waitUntil(client.flush())`, because a
  frozen instance may never finish it otherwise; the retention backstop then
  bounds the buffer.
- Every `record()` deletes the organization's events recorded more than
  `eventRetention` ago, in the same write. This is the backstop for events that
  never got a receipt, such as a 503 the application did not retry. The default
  is 7 days, so only events the server never accepted are affected, and for
  those the server view is the correct one. Set it in `defineConfig`.
- Reconciliation reads only events recorded inside the retention. The bound is
  the recording time, so a backdated event recorded now stays visible.

Events the API refuses with a 4xx are marked in `polar_void_rejected_events`
and leave reconciliation until the same ID is recorded again. Event reads and
standalone reducer queries still use the Void API. Connections are never closed
by `client.dispose()`.

### Postgres and serverless

A SQLite file is private to one process, so on serverless platforms one instance
cannot see what another just recorded. Use the Postgres adapter there: every
instance shares one ledger and reads its own writes across cold starts.

```ts
import { Pool } from 'pg'
import { defineConfig } from '@void/sdk/config'
import { postgresEventStorage } from '@void/sdk'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const config = defineConfig({
  schema,
  eventStorage: [postgresEventStorage(pool)],
})
```

The adapter accepts anything that runs one parameterized statement with `$1`
placeholders: `pg.Pool` or `pg.Client`, Neon's `neon(url)`, and postgres.js
clients through their `unsafe` method. Each operation is a single statement and
no transaction is ever opened, so pooled connections through PgBouncer and
one-shot HTTP drivers work the same. Keep the database in the region where the
functions run; every `record()` pays one round trip to it before the API call.

Create the tables once with a migration containing `postgresEventStorageSchema`,
or call `initializePostgresEventStorage(pool)` at deploy time. Pass
`{ createTables: true }` to create them on first use instead, which suits
development but takes DDL locks and needs DDL rights on every cold start.
Without tables, the first operation rejects with a message naming both options.
The columns match the SQLite table with native types: `timestamptz` for times
and `jsonb` for metadata.

### Redis and Upstash

The Redis adapter is the same shared ledger over Redis, for platforms where a
Postgres round trip is too slow or where Upstash is already in place.

```ts
import { Redis } from '@upstash/redis'
import { defineConfig } from '@void/sdk/config'
import { redisEventStorage } from '@void/sdk'
import * as schema from './schema'

export const config = defineConfig({
  schema,
  eventStorage: [redisEventStorage(Redis.fromEnv())],
})
```

The adapter accepts Upstash's `Redis` as it is and an ioredis client, which it
detects. Any other client fits through a one-line wrapper exposing
`eval(script, keys, args)`. Each operation is one Lua script, so writes are
atomic without transactions and HTTP and socket clients behave the same.

There is no schema to apply. Events live under `polar_void:{<organization>}:`
keys, and every key expires after the configured `eventRetention`; each write
also prunes the organization's expired entries, so memory stays bounded with
or without traffic.

`memoryEventStorage()` is an in-process reference adapter for tests. To write
your own adapter, implement `EventStorage` from `@void/sdk/config`; the contract
is documented on the interface and `test/event-storage.conformance.ts` in the
SDK package checks an implementation against it.

### Reconciled meter checks and balances

With `eventStorage` configured, `actor.meters.<name>.check({ estimate })` loads
`GET /v1/customers/{root}/state` and merges local events into that snapshot before
evaluating the estimate. The root must belong to a customer. Without local storage,
the SDK continues to use the existing remote meter-check endpoint.

Customer state is compact by default: current meter generations, identity balances,
reducer definitions, and each reducer's last processed event. It contains no bucket
or lifecycle history unless the caller supplies `since`.

The SDK reads the local events for the customer's identities that were recorded
inside `eventRetention`, through an indexed range. There are no local
reconciliation cursors or pending tables. The only write a check starts deletes
local events the returned receipts have confirmed, in the background.

When local events overlap the range, the SDK requests `state?since=...`, starting one
bucket before the oldest event. The response supplies a compact base, summary values
for the open reducer segment, and only the required replay tail. This preserves
min/max, negative credit adjustments, and subscription rollover.

Each returned bucket carries its last processed event and exact included event IDs,
saved atomically with its result. These IDs prevent double counting, including events
at the same timestamp. Missing legacy processing metadata causes an explicit
reconciliation error when local events overlap.

This is an event-time range, not a guarantee that all earlier events were processed.
Backdated events before the remote timestamp, including buckets processed out of
order, become visible through normal remote processing rather than immediate local
reconciliation.

Usage and credits are reduced separately with the deployed definitions, verified
against the SDK config. Sum/count add; min/max merge with their own operation.
Credit ownership, subtree usage, subscription boundaries and rollover, and every
holder up the actor's chain are preserved. Multiple local databases are deduplicated
by event ID; conflicting copies fail the check. Failed API writes remain local and
participate in reconciliation while inside the event-time range. This does not retry ingestion or
reserve credits across concurrent requests.

`balance()` is where an identity stands: `usage` and `credits` are its own, what
its subtree spent and what it holds, while `remaining`, `limitedBy` and `limit`
come from the chain the way `check()` sees it. A member that holds nothing still
learns what its cap and the root's pool leave it.

With local storage configured, `balance()` also reconciles local events by
default. It returns the identity's own credits minus its subtree's usage, plus
`overage` and `reconciliation` details. Unlike `check()`, it does not apply
ancestor limits or need an estimate. It does not write events or reserve credits.

```ts
await actor.meters.credits.balance() // includes local events
await actor.meters.credits.balance({ reconcile: false }) // remote only
await actor.meters.credits.balance(new Date(timestamp)) // historical, remote only
```

`balance({ at })` also reads a historical remote balance. Combining `at` with
`reconcile: true` rejects because customer state does not support historical
local reconciliation. Without local storage, balances remain remote-only.
`total()` and event listings retain their existing remote behavior.

In the original Void checkout, upgrade the server database with
`uv run alembic upgrade head`, deploy the updated Tinybird
resources, and restart the API and worker before enabling these SDK checks.
Populate receipts for existing results with `uv run python -m scripts.touch_buckets
<organization-id-or-slug>` from `server/`, and wait for recomputation to finish.

## Compiled config version 2

The compiled config is now `{ version: 2, events, reducers, meters }`. The unused `plugins` config option and the single `app` plugin wrapper have been removed. The deploy request still sends reducers and meters in the same fields.

This changes config checksums. Run `void plan`, then `void deploy` with the new SDK before starting clients with the new checksum. Deployment history is stored on the server.

The builder example has been migrated from `customer().track()` to identity scopes and `events.<export>.record()`. Event history uses `actor.events.<export>.list({ limit })`, defaulting to 100 matching events, with a maximum of 1000. The server filters by event name before applying the limit. Event metadata and reducer record data use the declared TypeScript types without runtime field validation. Deploy the updated server and Tinybird `events_list` endpoint before using the new event-name filter.

`actor.customer()` reads the database customer associated with the identity's root. A reducer exported as `customer` remains accessible through `actor.reducers.customer.latest()`, but represents event-derived state, not the customer entity.

The first argument to `meter('tokens', ...)` is its stable slug. Deployment and SDK resolution match this slug across generations, independently of the display name. Compiled meter entries now use `slug` instead of `name`; run `void deploy` against the updated server. Existing meters whose name and slug match retain their identity.

Run `pnpm --filter @void/sdk generate` from Polar's `clients/` directory to regenerate the schemas, HTTP client, and grouped Promise API in `src/api/generated.ts` from the checked-in private API contract, `openapi.json`. Resource groups and methods come from its `resource:action` operation IDs; input types come directly from the generated HTTP client. No endpoint registry is maintained in the SDK.

## Runtime architecture

`createVoid()` assembles a shared Effect runtime and Promise runner, per-client identity context, query builder, and identity scopes.

- `runtime/scope.ts` owns identity creation, parent checks, and tree navigation. It attaches queries through an injected builder.
- `runtime/snapshot.ts` binds a server identity snapshot to the config's exported meter names.
- `runtime/queries.ts` owns config-derived query types, query construction, request defaults, and response transformations. Dynamic property typing and caller-declared metadata are handled here.
- `runtime/context.ts` owns asynchronous identity context and reading identity headers. `runtime/middleware.ts` ensures each request identity and enters its scope.
- `runtime/resolve.ts` caches the mapping from config names to server IDs.
- `api/` owns generated HTTP operations, authentication, response validation, and SDK errors. The shared runner executes internal Effects as public Promises.

Config compilation and CLI deployment use the same definitions independently of identity scopes. Middleware still ensures the identity on each request; explicit scopes remain available through `as()`, `root()`, and `ensure()`.

Checks and current balances with local storage include `reconciliation`: `applied`, `eventCount`,
`remoteRemaining`, and `localAdjustment`. The adjustment is the difference in
available credits (including ancestor limits for checks), not the sum of raw event amounts.
Already processed events do not count; local events that cancel each other still
report `applied: true`. Checks without local storage omit this field.

## Map metadata before reducing

Use `map(source, projection)` with any event reducer. Filtering reads the original event;
then the projection replaces its user `metadata` before aggregation.

```ts
import { event, map, on, sum, last } from '@void/sdk/config'

const usage = event<{ asdf: number; label: string; status: string }>('usage')
const mapped = map(on(usage, { status: 'ok' }), {
  amount: '$asdf + 20',
  label: '$label',
})
export const total = sum('total', mapped, 'amount')
export const latest = last('latest', mapped)
```

The reducer's JSON includes an optional `map` object:

```json
{
  "slug": "total",
  "filter": {
    "conjunction": "and",
    "clauses": [{ "property": "name", "operator": "eq", "value": "usage" }]
  },
  "map": { "amount": "$asdf + 20", "label": "$label" },
  "aggregation": { "func": "sum", "property": "amount" }
}
```

- Omitted or `null` maps preserve metadata; `{}` produces an empty object. Include
  every field you want to retain when supplying a map.
- `$key` reads a top-level user metadata key and preserves its JSON type. Keys in
  expressions use letters, digits, and underscores, starting with a letter or
  underscore. Event envelope fields such as `name` and IDs are not available.
- Strings containing `$` are expressions. Numeric `+`, `-`, `*`, `/`, unary signs,
  parentheses, decimals, and scientific notation are supported with normal
  precedence. Other values are literal JSON; nested objects and arrays remain
  literal, including any strings inside them.
- Every expression reads the original metadata, including when another output
  field has the same name. Missing references produce `null`. Arithmetic requires
  numbers; numeric strings, booleans, missing values, division by zero, and
  nonfinite results produce `null`.
- `sum`, `min`, and `max` read the projected property and skip nonnumeric results;
  `first` and `last` return projected records. `count` counts matching events.

Maps are included in deployment checksums and local reconciliation. As with
filters and aggregations, changing a deployed reducer's map requires a new slug.

### Double each value, then sum

```ts
const reading = event<{ asdf: number }>('reading')
const doubled = map(reading, { amount: '$asdf * 2' })
export const doubledTotal = sum('doubled-total', doubled, 'amount')
```

The corresponding reducer fields are:

```json
{
  "map": { "amount": "$asdf * 2" },
  "aggregation": { "func": "sum", "property": "amount" }
}
```

| Input `asdf` values                   | Mapped `amount` values | Sum   |
| ------------------------------------- | ---------------------- | ----- |
| `10, 20, 30`                          | `20, 40, 60`           | `120` |
| `-2, 0, 1.5`                          | `-4, 0, 3`             | `-1`  |
| `10, 20, 10`, filtered to `asdf = 10` | `20, 20`               | `40`  |
| `10`, missing, `"20"`, `null`         | `20, null, null, null` | `20`  |

To filter first, use `map(on(reading, { asdf: 10 }), { amount: '$asdf * 2' })`.
The sum always reads the mapped `amount` field.

## Derive metrics from reducers

```ts
import { count, defineConfig, derive, event } from '@void/sdk/config'

export const opened = count('opened-checkouts', event('checkout.opened'))
export const sold = count('sold-checkouts', event('order.created'))
export const conversion = derive(
  'checkout-conversion',
  { opened, sold },
  '$sold / $opened * 100',
)

export default defineConfig({ schema: { opened, sold, conversion } })
```

`derive` accepts named count/sum/min/max event reducers. Inputs are collected into
config automatically, even when only the derived reducer is exported. A derived
reducer cannot depend on another derived reducer or be attached to a meter.
Formulas support the same arithmetic grammar as maps: named `$inputs`, numeric
constants, parentheses, unary signs, and `+`, `-`, `*`, `/`.

```ts
const monthly = await actor.reducers.conversion.usage({
  start: new Date('2026-01-01T00:00:00Z'),
  end: new Date('2026-02-01T00:00:00Z'),
  interval: 'month',
})
const allTime = await actor.reducers.conversion.total() // number | null
```

The server stores input state and the computed value in five-minute buckets.
Monthly values, totals, and identity groups merge the stored inputs before
calculating the formula. For example, 2/10 and 3/90 combine into 5/100 = 5%,
not the sum or average of their percentages.

Updates are asynchronous: either source updating triggers recomputation. Missing
count/sum inputs contribute zero; missing min/max inputs contribute null.
Arithmetic with null, division by zero, and non-finite results yields null,
which derived query types preserve in both totals and periods. Available input
state is retained even when the five-minute result is undefined.

Upgrade the server database and restart the API and worker before deploying these
definitions. New derived reducers automatically backfill from existing input buckets.
