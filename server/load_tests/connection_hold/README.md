# Primary connection hold benchmark

A/B test of how long each API request holds a connection from the primary database
pool. It compares `BASE_REF` with the working tree, under the same load.

## What it runs

- The real app (`polar.app:app`) under uvicorn, one worker, `POLAR_DATABASE_POOL_SIZE=10`.
  That is the production per-worker setup: a pool of 10 plus SQLAlchemy's default
  overflow of 10.
- A separate read-replica pool. It points at the same Postgres, but connects as the
  read role (`POLAR_POSTGRES_READ_USER`), so Postgres can tell the two pools apart.
- `latency_proxy.py` sits in front of the replica pool only. It adds a fixed delay to
  every replica round trip. The delay stands in for everything a request does after
  auth without touching the primary: slow replica queries, outside HTTP calls, a
  remote replica.
- Two open-loop request streams, each fired on a fixed schedule whatever the server's
  response time:
  - `replica_read`: `GET /v1/products/`, cookie auth, served from the replica session.
  - `primary_write`: `POST /v1/customers/`, organization-token auth, writes to the primary.
- Every 20 ms, a sample of `pg_stat_activity`. The connection counts come from
  Postgres, not from the app.

## Running

Needs the usual local stack (Postgres, Redis, `server/.env`, the email renderer binary).

```bash
cd server
BASE_REF=origin/main load_tests/connection_hold/run.sh
```

It creates a worktree of `BASE_REF` and a scratch `polar_bench` database, which it drops
and re-creates. It writes one JSON line per run to `results.jsonl` and prints a summary
table. Knobs (environment variables): `REPEATS`, `DELAYS` (milliseconds per replica round
trip), `READ_RPS`, `WRITE_RPS`, `DURATION`.

## Reading the summary

- **primary conns busy**: primary connections that are checked out (`active` or
  `idle in transaction`), averaged over the run.
- **primary conn-ms per request**: busy connections divided by requests per second
  (Little's law). It is the primary connection time each request costs.
- **write / read p50, p99**: latency measured from the scheduled send time, so queueing
  is included.
- **errors**: non-2xx responses. Under pool exhaustion these are 500s from
  SQLAlchemy's 30-second `pool_timeout`.

Absolute latencies depend on the machine. Compare `before` and `after` within one run of
the script.

## Results: authenticating before committing (#1)

Measured on a 4-CPU cloud container. `BASE_REF` is the commit before
`fix(auth): release the primary connection right after authentication`. Load: 15 replica
reads/s and 3 primary writes/s on one worker, 40 s per run after a 5 s warm-up. Each row
is the median of 2 repeats; the before and after runs were interleaved.

| replica delay | version | primary conns busy (avg / max) | primary idle in tx (avg) | primary conn-ms per request | write p50 / p99 (ms) | write errors | read p50 / p99 (ms) | read errors |
|---|---|---|---|---|---|---|---|---|
| 0 ms | before | 5.0 / 20 | 4.5 | 275 | 136 / 1927 | 0/242 | 140 / 2153 | 0/1202 |
| 0 ms | after | 2.2 / 20 | 1.6 | 122 | 138 / 2574 | 0/242 | 143 / 3026 | 0/1202 |
| 25 ms | before | 17.0 / 20 | 16.4 | 940 | 1162 / 4006 | 0/242 | 1878 / 4592 | 0/1202 |
| 25 ms | after | 2.0 / 20 | 1.4 | 110 | 217 / 2414 | 0/242 | 1031 / 4218 | 0/1202 |
| 50 ms | before | 19.8 / 20 | 19.6 | 1098 | 7092 / 13825 | 0/242 | 9008 / 17351 | 0/1202 |
| 50 ms | after | 2.0 / 20 | 1.3 | 112 | 136 / 2597 | 0/242 | 8604 / 18817 | 0/1202 |
| 75 ms | before | 19.9 / 20 | 19.7 | 2074 | 11403 / 20883 | 110/242 | 12837 / 26779 | 567/1202 |
| 75 ms | after | 1.7 / 19 | 1.1 | 159 | 116 / 2260 | 8/242 | 14468 / 54747 | 595/1202 |

What it shows:

- Before, a request holds a primary connection for its whole duration, even when it only
  reads from the replica. Almost all of that time is `idle in transaction`. Primary
  connection time per request grows with request time: 275 ms → 2,074 ms.
- After, primary connection time per request stays at 110–160 ms whatever the replica
  does. That is the auth queries plus the writes' own transactions.
- Once replica reads take long enough, the old code fills the primary pool (20/20).
  Writes, which never touch the replica, then queue for a connection: write p50 rises
  from 136 ms to 7–11 s, and at 75 ms 45% of writes fail. After the fix, write latency is
  unchanged in every scenario.

What it does not show:

- The fix does not make replica reads faster. Once the replica pool (also 20) is
  saturated, reads degrade the same way in both versions. At 25 ms they are faster
  after the fix only because they no longer wait for a primary connection to run auth.
- At 75 ms the worker is overloaded overall. The 8 write failures after the fix are
  requests caught behind hundreds of stuck reads on the same event loop, not pool
  waits.
- At 25 ms the old code sits right at the saturation point. One repeat collapsed
  (write p50 2.2 s) and the other did not (166 ms). Both held 14–19 primary connections,
  against about 2 after the fix.
- The CPU in this container is slow, about 40 ms per authenticated request. The
  injected replica delay stands in for request time that production gets from real
  sources: replica queries, Tinybird, Stripe, DNS. The quantity that carries over is
  primary connection time per request: before the fix it equals the request's full
  duration, after it equals the auth queries plus the request's own primary work.
