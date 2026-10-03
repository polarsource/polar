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
