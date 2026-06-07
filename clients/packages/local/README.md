# @polar-sh/local

Local-first, **billing-as-code** usage metering for [Polar](https://polar.sh).

Run it as a sidecar on your own infra: your app sends usage events to `local`, which stores them durably, gives you an **instant invoice preview**, and forwards everything to Polar in the background — surviving outages and reconciling itself against Polar's authoritative numbers.

```
your app ─▶ /v1/ingest ─▶ durable log ──┬─▶ invoice preview   (local, instant)
                          (commit point) │
                                         └─▶ forward to Polar   (at-least-once,
                                             retries + dedup)    Polar = source of truth
```

Polar stays the system of record (it invoices and charges). `local` is the fast, deterministic layer in front of it: real-time balances, limit enforcement, pricing experiments, and a buffer that keeps working when Polar is unreachable.

## How it works

The path one usage event takes:

1. **Ingest.** Your app POSTs Polar-shaped events to `/v1/ingest`. Each is validated and stamped with a timestamp.
2. **Commit.** The event is durably appended to a local append-only log (SQLite). This append is the commit point — once it returns, the event survives a crash. Nothing downstream can lose it.
3. **Preview.** `/v1/preview` folds that log through the versioned ruleset on demand to produce an invoice. The fold is pure and entirely local, so previews are instant and need no round-trip to Polar.
4. **Forward.** A background flusher drains the same log to Polar at-least-once, tracking a durable cursor; Polar deduplicates on `external_id`, making delivery effectively-once. While Polar is unreachable, events keep buffering and ingest/preview keep working.
5. **Reconcile.** `/v1/reconcile` diffs local totals against Polar's metered numbers, and self-heal re-sends anything Polar is missing (safe, thanks to dedup). Polar's numbers are authoritative for money.

The log is the linchpin: it's both the source the preview fold replays and the outbox the flusher forwards, so the two can never disagree about what happened — only about how far delivery has progressed.

## Deploy it

`local` is stateful — its durable log is the commit point — so the primary way to run it is as a **long-lived sidecar** next to your app, with a persistent volume. Your app talks to it over HTTP on the private network.

### Sidecar (recommended)

Docker (build from the `clients/` workspace root, since it depends on the `@polar-sh/client` workspace package):

```bash
cd clients
docker build -f packages/local/Dockerfile -t polar-local .        # or: pnpm --filter @polar-sh/local docker:build

docker run --rm -p 8787:8787 -v polar-local-data:/data \
  -e POLAR_ACCESS_TOKEN=polar_... \
  -e LOCAL_DB_PATH=/data/local.db \
  -v "$PWD/billing.ts:/billing/billing.ts" -e LOCAL_BILLING=/billing/billing.ts \
  polar-local
```

Or run the bundled CLI directly (Node ≥ 24, configured purely by env):

```bash
polar-local                  # when installed; or `pnpm --filter @polar-sh/local start` in-repo
```

The container persists `/data` so buffered events survive restarts, and exposes `GET /health` as a Docker healthcheck.

### Embedded handler (advanced)

The whole service is a web-standard `(Request) => Promise<Response>`, so you can mount it inside an existing fetch-style backend (Hono, Bun, Deno, a Next.js route) via `@polar-sh/local/server`:

```ts
import { configFromEnv, createStore, makeHandler, polarClient, polarSink, runFlusher } from "@polar-sh/local/server";
import { Effect } from "effect";
import { history } from "./billing";

const config = configFromEnv();
const store = createStore(config.store);
const client = polarClient(config.polar);
const handler = makeHandler({ store, history, polarClient: client });
Effect.runFork(runFlusher(store, polarSink({ client }), config.flushIntervalMillis));
// mount `handler` under /v1 on your app
```

> **Caveat:** the only shipped durable backend is a per-instance SQLite file (single-writer). Embedding into a **multi-instance or serverless** app is only safe once a shared/remote store exists — see the roadmap. `createStore` (`src/create-store.ts`) is the seam where that backend plugs in.

## Quickstart (local dev)

```bash
pnpm install                          # at the workspace root (clients/)
POLAR_ACCESS_TOKEN=polar_... pnpm start
pnpm test
```

## Define your billing

Pricing lives in code, in `src/billing.ts`. Meters filter events by `name` and aggregate a `metadata` property — exactly how Polar's meters work:

```ts
import { perUnit, product } from "./dsl";
import { count, maxOf, sumOf } from "./meter";
import { cents, micros } from "./money";
import { rulesetHistory } from "./ruleset";

export const history = rulesetHistory([
  {
    version: "2026.1.0",
    effectiveFrom: Date.UTC(2026, 0, 1),
    plan: product("api-access")
      .meter("tokens",   sumOf("amount"), perUnit(micros(2n)))  // $0.000002 / token
      .meter("requests", count(),         perUnit(micros(50n)))
      .meter("seats",    maxOf("amount"), perUnit(cents(500)))  // $5.00 / peak seat
      .build(),
  },
]);
```

Money is always exact integer **micro-cents** — never a float. To change pricing, add a new ruleset version (don't edit an old one); history stays replayable.

## Use it

Send usage (the body is a batch of Polar-shaped events):

```bash
curl -X POST localhost:8787/v1/ingest -d '{
  "events": [
    { "name": "tokens", "external_customer_id": "acme",
      "metadata": { "amount": 1000000 }, "external_id": "evt-1" }
  ]
}'
# → { "ingested": 1 }
```

Get a live invoice preview, computed locally with no round-trip to Polar:

```bash
curl "localhost:8787/v1/preview?customer=acme&from=2026-01-01&to=2026-02-01"
```
```json
{
  "customerKey": "ext:acme",
  "rulesetVersion": "2026.1.0",
  "lines": [
    { "meter": "tokens", "quantity": "1000000", "amount": "2000000", "sourceEventIds": ["evt_1"] }
  ],
  "subtotal": "2000000",
  "totalCents": "2"
}
```

### HTTP API

| Endpoint | Does |
| --- | --- |
| `POST /v1/ingest` | Durably store a batch of events → `{ ingested }` |
| `GET  /v1/preview?customer&from&to[&version]` | Local invoice for a customer + period |
| `POST /v1/reconcile` | Diff the local numbers against Polar |
| `GET  /v1/deadletters` | Events Polar permanently rejected |
| `GET  /health` | Liveness + how many events are still buffered |

## Design guarantees

- **Deterministic & replayable.** Billing is a pure fold over an append-only event log. The same events always produce the same invoice — so you can recompute any period, test pricing with golden files, and trust the math.
- **Durable & fault-tolerant.** A local append is the commit point; ingestion and previews keep working even when Polar is down. Forwarding is at-least-once with retries; Polar deduplicates on `external_id`, making it effectively-once. A bad event gets dead-lettered instead of wedging the stream.
- **Self-correcting.** `reconcile` compares the local fold to Polar's metered totals; `selfHeal` re-sends anything Polar is missing (safe, thanks to dedup). Polar's numbers always win for money.
- **Versioned.** Each pricing version has an `effectiveFrom`. Recompute the past under the rules that were in effect, or run a what-if against any version:

```ts
invoiceFor(history, events, { customer, period: january });                       // time-travel
invoiceFor(history, events, { customer, period: january, version: "2027.1.0" });  // what-if
```

- **One source of truth.** Your `Plan` projects two ways: locally to the fold (previews, enforcement) and forward to Polar as meter config via `syncMeters` (config-as-code, not uploaded code). They can't drift at definition time, and reconciliation catches drift at runtime.

## Configuration

| Env var | Default | |
| --- | --- | --- |
| `POLAR_ACCESS_TOKEN` | — | **required** — organization access token |
| `POLAR_SERVER` | `production` | `production` or `sandbox` |
| `POLAR_ORG_ID` | — | only if the token isn't an org token |
| `LOCAL_PORT` | `8787` | |
| `LOCAL_STORE` | `sqlite` | durable backend: `sqlite` or `memory` (ephemeral) |
| `LOCAL_DB_PATH` | `local.db` | SQLite file (when `LOCAL_STORE=sqlite`) |
| `LOCAL_FLUSH_INTERVAL_MS` | `5000` | how often the background flusher forwards |

## Toolchain

Node ≥ 24 + pnpm. Storage uses the built-in `node:sqlite` (synchronous, no native build); Polar calls go through `@polar-sh/client`; tests run on [vitest](https://vitest.dev) and the service runs via [tsx](https://github.com/privatenumber/tsx). `local` deliberately mirrors Polar's event shape, so forwarding is nearly an identity map.

## Roadmap

Tiered/graduated pricing and adjustments (credits, discounts, proration) · product/price sync (beyond meters) · a periodic background reconcile loop · **a shared/remote `EventStore` (e.g. Postgres) for fleet mode** — the `createStore` seam is already in place; the remaining work is converting the (currently synchronous, SQLite-shaped) `EventStore` interface and its consumers to async. That backend is what makes the embedded handler safe in a multi-instance, stateless app.
