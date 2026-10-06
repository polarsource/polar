# Outpost

## Development

Start Outpost and Redis:

```sh
just dev
```

## Benchmark

Run the HTTP ingest benchmark:

```sh
uv run python benchmark.py
uv run python benchmark.py --batch-size 1000 --concurrency 8 --requests 2000
uv run python benchmark.py --batch-size 10 --concurrency 32 --requests 20000 --processes 4
```

Reports requests/s, events/s, and mean/p50/p95/p99 response time.

Uses up to four client processes by default, capped by concurrency and request count.
Requests, concurrency, and warmup are totals split across processes. Each process
warms up before a synchronized start; timings exclude startup, warmup, and Redis
verification. Use `--processes 1` to compare against a single client process.
