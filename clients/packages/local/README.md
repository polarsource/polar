# @polar-sh/local

A local-first, **billing-as-code** usage metering engine for [Polar](https://polar.sh). Deterministic, replayable, auditable, versioned. Built to be embedded and deployed on an integrator's own infra — it durably buffers usage events, forwards them to the Polar Ingestion API fault-tolerantly, and reconciles the local computation against Polar.

> **Toolchain note:** this is a [Bun](https://bun.sh) package (uses `bun:sqlite` and `bun test`), self-contained within the monorepo. Install deps via the pnpm workspace (it declares `@polar-sh/client` as `workspace:*`); run and test it with `bun` rather than the pnpm/turbo pipeline.

All Polar API calls go through **`@polar-sh/client`** (the monorepo's typed `openapi-fetch` client) — see `src/polar-client.ts`. Our modules take a `PolarClient` instance, so tests use a structural fake with no network.

> Prototype slices built: **determinism proof** + **durable store-and-forward to Polar**. Money is exact integer micro-cents. Effect is used where it earns its keep (clock, retries), not everywhere.

```bash
bun install
POLAR_ACCESS_TOKEN=... bun run src/main.ts   # start the sidecar service (see below)
bun test                     # full suite: engine, fault-tolerance, Polar sync, versioning, service
```

## The one idea

Everything is a **pure fold over a durable, append-only event log**. The same log is both the billing source of truth and the outbox forwarded to Polar:

A local event **is** a Polar ingestion event (same shape — see `src/polar.ts`) plus a thin internal envelope (`seq`, `id`, `v`). So forwarding is nearly an identity map, and the local meters aggregate over `metadata` exactly the way Polar's meters do — a local invoice preview mirrors what Polar will bill.

```
RawEvent ─▶ ingest ─▶ Store.append ──────┬──▶ pure fold ──▶ Invoice   (local, instant)
 (Polar    (stamp ISO  (durable commit    │   (meter by name,
  shape)    time;       point; dedups on   │    aggregate metadata)
  +metadata validate)   external_id)       └──▶ Flusher ──▶ PolarSink  (at-least-once,
                                                (retry/        Polar dedups on external_id)
                                                 isolate/cursor)
```

The log is the single source of truth. Invoices, meter totals, snapshots, and the Polar delivery cursor are all derived — delete and recompute any of them. Every property falls out of the fold being pure:

| Property | Where it comes from |
| --- | --- |
| **Determinism** | The fold reads nothing but events. Same events → byte-identical invoice (`test/golden/invoice.json`). |
| **Auditability** | Each invoice line carries the `sourceEventIds` that produced it. Every cent traces to events. |
| **Time travel** | Fold any prefix/subset of events to recompute billing as of any point in history. |
| **Testability** | Pure functions. Tests are input → expected output. No DB, no mocks. |
| **Composability** | Meters, prices, and (next) adjustments are independent units composed by the DSL. |

## Layout

| File | Role |
| --- | --- |
| `src/money.ts` | Exact money as integer **micro-cents** (`bigint`, branded). The one rule: a `number` never holds money. Rounding to cents happens once, explicitly. |
| `src/events.ts` | `UsageEvent` = Polar event union (customer_id XOR external_customer_id) + envelope. `customerKey` derives the grouping key. |
| `src/meter.ts` | Aggregation algebra over metadata — `count()`/`sumOf(p)`/`maxOf(p)`/`lastOf(p)`, mirroring Polar meters. Serializable state ⇒ snapshottable. |
| `src/dsl.ts` | Billing-as-code. `.meter(name, aggregation, price)` filters by event name + aggregates metadata. `product(...)` is *code*; the `Plan` is *data*. |
| `src/engine.ts` | The pure fold: `(plan, events) → state → invoice`, plus snapshot/restore. |
| `src/ingest.ts` | Stamps usage with the clock (`Clock` is an Effect *service*) and durably appends it. |
| `src/store.ts` | Durable persistence (`bun:sqlite`, WAL). The commit point + outbox + flush cursor + dead-letter queue. In-memory impl for tests. |
| `src/sink.ts` | Where events get forwarded. `polarSink` → `@polar-sh/client` `POST /v1/events/ingest`. Configurable mapping, local pre-validation, transient-vs-permanent failure classification. |
| `src/polar-client.ts` | `polarClient(...)` builds a `@polar-sh/client` instance (auth + base URL). The `PolarClient` type our Polar-facing modules depend on. |
| `src/polar.ts` | Local TypeScript mirror of the Polar event/meter shapes + `validatePolarEvent` (used for local pre-flight validation). |
| `src/compile.ts` | Pure: compiles a `Plan` → Polar meter definitions (filter by name + aggregation). Warns where a local meter has no Polar equivalent. |
| `src/push.ts` | `syncMeters` — idempotent apply of compiled meters to Polar via `@polar-sh/client`: create-missing, report drift, opt-in update. "Billing config as code." Also `listMeters`. |
| `src/reconcile.ts` | `reconcile` — diffs the local fold (delivered basis, at the flush watermark) against Polar's `meters/get-quantities`. Reports match / mismatch+delta / missing-meter. |
| `src/selfheal.ts` | `selfHeal` / `reconcileAndHeal` — re-sends the events behind under-delivered meters (safe via dedup); closes the loop reconcile → heal → reconcile. |
| `src/ruleset.ts` | Versioned billing rules. `Ruleset {version, effectiveFrom, plan}` + history; `invoiceFor` selects the ruleset effective at a period (time-travel) or an explicit version (what-if). |
| `src/billing.ts` | The integrator's billing-as-code: the `RulesetHistory` defining meters + pricing per version. The file you edit; your VCS is the audit trail. |
| `src/service.ts` | HTTP handler — `POST /v1/ingest`, `GET /v1/preview`, `POST /v1/reconcile`, `GET /v1/deadletters`, `GET /health`. A plain `Request → Response`, testable without a port. |
| `src/config.ts` · `src/main.ts` | Env config + the entrypoint: wires store/sink/handler, serves on a port, forks the background flusher, handles graceful shutdown. |
| `src/flusher.ts` | Drains the outbox to a sink: whole-batch fast path, backoff retry on outage, per-event isolation on poison, monotonic durable cursor. Exposes `deliver` (the shared send primitive). |
| `src/serialize.ts` | Canonical JSON (sorted keys, `bigint`→string) so equality is mechanically checkable. |

## Fault tolerance — the store-and-forward contract

The local append is the **commit point**: once `ingest` returns, the event is on disk and billable locally, network or not. Forwarding to Polar is then *at-least-once*, made *effectively-once* because Polar deduplicates on `external_id` (we map our `idempotencyKey` to it). The flusher's cursor only advances past an event once it's confirmed delivered or dead-lettered:

| Failure | What happens | Result |
| --- | --- | --- |
| Polar down / 5xx / 429 / network | Backoff-retry within the tick; if still failing, **halt with the cursor unmoved** | Events buffered, retried next tick. Nothing lost. |
| Process crash mid-flush | Cursor wasn't advanced → re-send on restart | Polar dedups the re-sends. No double billing. |
| Crash after delivery, before cursor write | Same — re-send, Polar dedups | Effectively-once. |
| Bad data (4xx validation) | Fall back to per-event sends, **dead-letter** the offender, keep draining | One poison event can't wedge the stream. |
| Restart | SQLite log + cursor persist; reopen resumes exactly where it left off | Proven in `test/flush.test.ts`. |

## Polar Ingestion API compatibility

Events are stored in Polar's native shape (`src/polar.ts` mirrors the `/v1/events/ingest` OpenAPI schema), so `polarSink` forwarding is nearly an identity map:

- **Event shape** — `UsageEvent` is literally `EventCreateCustomer | EventCreateExternalCustomer` + envelope. Customer keying (UUID vs external), `metadata`, `parent_id`, `organization_id`, member fields are all native. `_cost`/`_llm` structured metadata are typed.
- **Dedup** — `external_id` (required at ingest, our idempotency key) is what Polar deduplicates on. The response's `inserted`/`duplicates` flow back as `SinkResult`.
- **Metering matches Polar** — meters filter by event `name` and aggregate over a `metadata` property, the same model Polar uses, so the local invoice preview reflects Polar's billing.
- **Integer metadata** — ingest rejects non-integer metadata numbers (send fractional units pre-scaled), keeping the quantity×price math exact bigint. Stricter than Polar (which allows floats), by design.
- **Local pre-validation** — `name` ≤128, metadata key ≤40, string value ≤500, ≤50 pairs checked *before* the request (at ingest and in the sink), turning a remote 422 into an immediate, precise error.
- **Failure classification** — only `422` (per-event validation) is permanent and dead-letter-able; `429` (with `Retry-After`), `401/403`, `404`, `400`, `5xx`, and network errors are transient and stay buffered. For billing, a visible backlog beats dropping good events over a config mistake.
- **Environments** — `server: "production" | "sandbox"`, or an explicit `baseUrl`.

Rate limit is 500 req/min/org in production (100 in sandbox); batching keeps you well under it. There's no documented batch-size cap.

## Runtime model: who's authoritative

Polar is the **system of record** for billing — it meters, invoices, and charges. Critically, Polar's ingestion is *eventually-consistent and non-blocking* by design ("events are always ingested", it "will never prohibit any customer's action based on their meter balance", attribution is on receipt not timestamp). So local is **not** a competing biller; it's the local, deterministic, real-time layer that does what Polar deliberately won't:

| | local (local, real-time, deterministic) | Polar (authoritative, eventually-consistent) |
| --- | --- | --- |
| Instant balance / enforce limits | ✓ (local SQLite, no round-trip) | ✗ (lagged, never blocks) |
| Test pricing deterministically | ✓ (pure fold, golden tests) | — |
| Buffer through outages | ✓ (outbox) | — |
| The invoice that charges the card | preview/estimate | ✓ system of record |

**One Plan, two projections.** The `Plan` is the single versioned source of truth. It projects *forward* to Polar as declarative meter config (`compile.ts` → `push.ts` — config as code, **not** uploaded lambdas), and *locally* to the fold for preview/enforcement/testing. Because both derive from one artifact, they can't drift at definition time.

**Reconciliation.** Polar's numbers win for money; `reconcile` (in `src/reconcile.ts`) diffs the local fold against Polar's `meters/get-quantities` to catch drift, delivery gaps, and dead-lettered events. Two things keep the comparison honest: the **watermark** (local basis = events with `seq ≤ cursor`, minus dead-lettered ones — "what we believe Polar successfully ingested"), and a **wide window** (Polar attributes by receipt time, not event timestamp, so reconcile over a window broad enough that `total` is directly comparable). It's a delivery-integrity check, not a per-bucket audit.

**Self-heal** (`src/selfheal.ts`) closes the loop. For meters where Polar is *short* (positive delta), `selfHeal` re-sends exactly the events behind them — the reconciliation basis filtered to those meters. Safe by construction: at-least-once + Polar's `external_id` dedup means already-received events are no-ops while the missing ones land. It deliberately *won't* re-flush negative deltas (Polar over-counted — an anomaly to investigate) or missing meters (run `syncMeters` first); those surface as `skipped`. `reconcileAndHeal` runs reconcile → heal → reconcile so `after.ok` tells you the gap actually closed.

## Versioning: time-travel and what-if

Billing rules are versioned in `src/billing.ts` as a `RulesetHistory` — an ordered list of `{ version, effectiveFrom, plan }`. To change pricing you **add a new ruleset** rather than mutate an old one, which keeps history replayable:

- **Time-travel** — `invoiceFor(history, events, { customer, period })` bills a period under the ruleset effective at its start. Recompute January and you get January's prices, even after a February hike.
- **What-if** — pass `version` to bill the same usage under a different ruleset (`invoiceFor(..., { version: "2026.2.0" })`).

Determinism makes both exact: same events + same ruleset → same invoice. The `Plan` is your code; the `effectiveFrom` is when it takes over; your VCS history is the audit trail. (One ruleset per invoice, selected at period start; mid-period switches are out of scope.)

## Running it as a service

`bun run src/main.ts` starts the sidecar: your app POSTs usage to local, which persists it durably, serves instant local previews, and forwards to Polar in the background.

```
POST /v1/ingest      { events: RawEvent[] }            → { ingested }
GET  /v1/preview     ?customer&from&to[&version]       → Invoice (local, instant)
POST /v1/reconcile   { customer, from, to }            → ReconcileReport
GET  /v1/deadletters                                   → the dead-letter queue
GET  /health                                           → liveness + delivery lag (undelivered count)
```

Config via env: `POLAR_ACCESS_TOKEN` (required), `POLAR_SERVER` (production|sandbox), `POLAR_ORG_ID`, `LOCAL_PORT` (8787), `LOCAL_DB_PATH` (local.db), `LOCAL_FLUSH_INTERVAL_MS` (5000). The local SQLite store is the commit point, so ingestion and previews keep working even while Polar is unreachable — the backlog drains when it recovers. Single-instance today; a shared store across stateless instances is the (parked) async-store path. For drop-in distribution, `bun build --compile src/main.ts` produces a single binary.

## Design decisions (and why)

- **Integer micro-cents, not floats or `BigDecimal`.** Usage prices are tiny fractions of a cent; integers are exact, fast, trivially serializable, and the brand makes float-money a compile error. 1¢ = 1,000,000 µ¢.
- **The fold has no clock.** Wall-clock time is touched only at ingestion, then frozen into events. This is the linchpin of replay: re-folding old events can never drift.
- **Plan = data, builder = code.** You author pricing in type-safe TS, but the engine consumes plain data — so a Plan can later be stored, diffed, version-pinned, or compiled to from an external DSL without touching the engine.
- **Snapshots are disposable checkpoints.** `replay` can resume from a snapshot + tail instead of from genesis, keeping local recompute fast as the log grows. The event log stays canonical.
- **Local append is the commit point; delivery is at-least-once.** We never try to make the network exactly-once (impossible); instead we lean on Polar's `external_id` dedup. Delivery state (the cursor) lives beside the log, never on the events, so replay is unaffected by network history.
- **Transient vs. permanent failures are different code paths.** A 5xx buffers; a 4xx dead-letters. Conflating them either drops good events or wedges the stream on one bad one.

## Not built yet (next slices)

- **Versioning / time-travel in full** — ruleset-as-events with `effectiveFrom`; recompute a past period under the rules *as they then stood* vs. a what-if ruleset.
- **Composable breadth** — tiered/graduated/package pricing, and adjustments (credits, discounts, proration) as a transform stage on line items.
- **Product/price sync** — extend the compiler beyond meters to Polar products/prices (the pricing half of the Plan).
- **Fleet mode** — a shared (async Postgres) store so several stateless service instances share one buffer/balance. The single-instance sidecar is built; this is the parked async-store fork.
- **Background reconcile loop** — the service exposes reconcile on demand; running it periodically across all customers needs customer enumeration in the store.

## Why Node/Bun + Effect

No compelling reason to leave Node for this. The determinism threats (float money, ambient clock/RNG, iteration order) are discipline problems, and Effect's "effects are values, clock is a service" model is exactly that discipline in a language integrators can read and run. The one thing JS won't give you for free is decimal money — solved here by integer micro-cents. If single-binary distribution to integrators becomes the priority, the pure, dependency-light core compiles to a standalone executable without a rewrite.
