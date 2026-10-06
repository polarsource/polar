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
```

Reports requests/s, events/s, and mean/p50/p95/p99 response time.

### Results 1

First implementation, with reduction made in Python in a single thread.

```
HTTP /ingest; count meter matching tool_call events
10,000 requests × 10 events; concurrency=8; customers/batch=10; warmup=10 (excluded)
2.403s; 4,162 requests/s; 41,623 events/s
Stage (ms/request)           mean        p50        p95        p99
ingest                      1.919      1.863      2.468      2.973
Redis counts verified; benchmark keys removed.
```
