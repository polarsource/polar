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

## Quickstart

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

## How it works

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
| `LOCAL_DB_PATH` | `local.db` | SQLite file |
| `LOCAL_FLUSH_INTERVAL_MS` | `5000` | how often the background flusher forwards |

## Toolchain

Node ≥ 24 + pnpm. Storage uses the built-in `node:sqlite` (synchronous, no native build); Polar calls go through `@polar-sh/client`; tests run on [vitest](https://vitest.dev) and the service runs via [tsx](https://github.com/privatenumber/tsx). `local` deliberately mirrors Polar's event shape, so forwarding is nearly an identity map.

## Roadmap

Tiered/graduated pricing and adjustments (credits, discounts, proration) · product/price sync (beyond meters) · fleet mode (a shared store for multiple instances) · a periodic background reconcile loop.
