# Polar Sidecar

A small FastAPI app that sits in front of the Polar API.

- `POST /v1/events/ingest` buffers events in a local database and returns
  immediately. A background sync loop forwards unacknowledged events upstream
  and stamps `acknowledged_at` once Polar confirms them, so events survive
  upstream downtime. The event timestamp is stamped at ingest time when the
  caller doesn't supply one, preserving when the event actually happened.
- `GET /v1/customer-meters/` is intercepted: the sidecar merges locally-buffered
  events into the upstream balance and caches each meter for offline reads.
- Every other request falls through to a transparent proxy to the Polar API.

## Architecture

Ingest persists every event locally and returns immediately; a background flush
loop forwards them upstream, so ingestion never blocks on Polar. Customer-meter
reads and a background poller also talk to Polar, falling back to a local cache
when it is unreachable.

```mermaid
flowchart TB
    App["Customer App<br/>(trusted private network)"]

    subgraph Sidecar["Polar Sidecar — single instance, one org token"]
        direction TB
        Router{"Route by path"}
        Ingest["POST /v1/events/ingest<br/>validate · stamp ts · store-first"]
        Meters["GET /v1/customer-meters/<br/>merge upstream + local delta"]
        Pass["Passthrough<br/>any other request"]

        DB[("SQLite buffer<br/>events table")]
        MCache[("customer_meters<br/>cache")]

        Flush["Flush loop<br/>(background · FIFO batches)"]
        Poller["Meter poller<br/>(background · delta-driven)"]
    end

    Polar["Polar API (upstream)"]

    App -->|all requests| Router
    Router -->|events ingest| Ingest
    Router -->|customer-meters GET| Meters
    Router -->|everything else| Pass

    Ingest -->|"persist + return {inserted, duplicates} immediately"| DB
    Flush -->|read unacknowledged| DB
    Flush -->|"POST ?return_events=true<br/>(sidecar token)"| Polar
    Polar -.->|"2xx → ack + store polar_event_id"| Flush

    Meters -->|read local delta| DB
    Meters -->|"forward (caller auth)"| Polar
    Polar -.->|"200 → cache + merge · unreachable → serve cache"| Meters
    Meters --> MCache
    Poller -->|"poll dirty customers (sidecar token)"| Polar
    Poller --> MCache

    Pass -->|"forwards caller's Authorization as-is"| Polar
    Polar -.->|response| Pass
```

### Ingest validation & flush retries

Poison is rejected at the door: ingest mirrors Polar's stateless checks
(`external_id` required, no `organization_id`, `name` ≤ 128, timezone-aware past
`timestamp`) and returns `422` without buffering. Valid events are stamped,
deduped on `external_id`, and stored. The flush loop retries every failure with
backoff, so a Polar outage just lets the buffer grow.

```mermaid
flowchart TD
    In["POST /v1/events/ingest"] --> Val{"stateless validation"}
    Val -->|invalid| Reject["422 — rejected, never buffered"]
    Val -->|valid| Store["stamp ts if absent ·<br/>dedupe on external_id ·<br/>store in SQLite"]
    Store --> Ack["return {inserted, duplicates}"]

    Loop["flush loop<br/>(every FLUSH_INTERVAL_SECONDS)"] --> Read["read unacknowledged FIFO batch"]
    Read --> Post["POST upstream ?return_events=true<br/>(sidecar token)"]
    Post -->|2xx| Done["stamp acknowledged_at ·<br/>record polar_event_id"]
    Post -->|"any error"| Keep["log · keep events · retry next cycle"]
```

> A distinct unhealthy state that returns `503` backpressure on auth failures is
> not yet implemented — the loop currently retries every failure uniformly,
> including a bad token.

## Local meters

The sidecar intercepts `GET /v1/customer-meters/` (list + get), mirrors the
upstream meters into a local cache, and merges in locally-buffered events that
upstream hasn't counted yet, so the balance reflects just-ingested usage. Only
`count` / `sum` meters are merged; everything else is served upstream as-is.

### Read path

A read forwards to upstream, caches the snapshot, and merges the local delta into
the fresh response. When upstream is unreachable it serves the cached snapshot
with the delta merged in (or `503` for an uncached single meter).

```mermaid
flowchart TD
    Start["GET /v1/customer-meters/<br/>(list or /{id})"] --> Fwd["forward to upstream<br/>(caller's auth)"]
    Fwd --> Reach{"upstream<br/>reachable?"}

    Reach -->|"200"| CacheIt["cache snapshot(s)"]
    CacheIt --> MergeFresh["merge delta into fresh response"]
    MergeFresh --> Resp["respond"]

    Reach -->|"connection error / 5xx / 408 / 429"| Cached{"cached?"}
    Cached -->|"yes"| MergeCache["merge delta into cached snapshot"]
    Cached -->|"no — single meter"| E503["503 — unreachable & uncached"]
    Cached -->|"no — list"| EmptyList["return cached set (may be empty)"]
    MergeCache --> Resp
    EmptyList --> Resp

    Reach -->|"other non-200 (4xx)"| Proxy["proxy upstream response as-is"]
    Proxy --> Resp
```

### Merge computation

`consumed_units` upstream aggregates user events (all of which flow through the
sidecar); `credited_units` comes from system events the sidecar never sees — so
only `consumed` needs a local delta. Meter resets are free: the frontier advances
to a post-reset event, so rows past it are automatically post-reset.

```mermaid
flowchart TD
    M["upstream customer-meter<br/>consumed · credited · balance ·<br/>last_balanced_event_id · filter · aggregation"] --> Summable{"aggregation<br/>is_summable?"}
    Summable -->|"no — max / min / avg / unique"| Up["serve upstream as-is"]

    Summable -->|"yes — count / sum"| Frontier{"last_balanced_event_id<br/>resolves to a local row?"}
    Frontier -->|"no — not buffered locally"| Up
    Frontier -->|"yes, or null (no watermark)"| Delta["delta = local events matching customer<br/>(ext_id OR customer_id), past the watermark<br/>OR missing polar_event_id (conservative),<br/>passing filter + aggregation"]
    Delta --> Zero{"delta == 0?"}
    Zero -->|yes| Up
    Zero -->|no| Compute["consumed += Σ delta<br/>balance = credited − consumed"]
```

### Polling lifecycle

A meter enters the cache the first time a read for it reaches upstream. The
background poller then re-polls only customers whose buffered events haven't been
balanced upstream yet; once upstream catches up, the customer drops out of the
poll set until new events land.

```mermaid
stateDiagram-v2
    [*] --> Uncached
    Uncached --> Cached: a read reaches upstream and caches the snapshot
    Cached --> Polling: buffered events past the watermark (dirty)
    Polling --> Polling: poll cycle — delta still exists
    Polling --> Converged: upstream balanced up to our latest matching event
    Converged --> Polling: new matching event lands (re-arm)

    note right of Polling
        Background poll, one call per
        external_customer_id — returns
        all that customer's meters.
    end note
    note right of Converged
        Poller idle until re-armed.
        Reads still refresh from upstream.
    end note
```

## Configuration

| Variable                 | Default                              | Description                                            |
| ------------------------ | ------------------------------------ | ------------------------------------------------------ |
| `POLAR_SERVER`           | `production`                         | Named Polar server (`production`/`sandbox`).           |
| `POLAR_SERVER_URL`       | _(unset)_                            | Overrides `POLAR_SERVER` with a full URL.              |
| `DATABASE_URL`           | `sqlite+aiosqlite:///./sidecar.db`   | SQLAlchemy async URL for the local buffer.             |
| `POLAR_ACCESS_TOKEN`     | _(unset)_                            | Token the flush + poll loops use upstream. Unset = both idle. |
| `FLUSH_INTERVAL_SECONDS` | `5`                                  | Seconds between flush loop cycles.                     |
| `FLUSH_BATCH_SIZE`       | `100`                                | Max events forwarded per cycle.                        |
| `POLL_INTERVAL_SECONDS`  | `10`                                 | Seconds between customer-meter poll cycles.            |
| `SQLITE_BUSY_TIMEOUT_MS` | `5000`                               | SQLite busy-timeout for the WAL-mode writers.          |

## Running

```bash
uv sync
uv run task api   # http://127.0.0.1:8000
```
