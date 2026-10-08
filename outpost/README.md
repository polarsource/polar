# Outpost

## Development

Outpost reads its reducers from Polar over a WebSocket. It needs an organization token with
`events:write`:

```sh
export POLAR_TOKEN=polar_oat_...
export POLAR_API_URL=http://127.0.0.1:8000  # default: https://api.polar.sh
```

Start Outpost with in-memory storage (default, one worker):

```sh
just dev
```

Memory storage is process-local and lost on restart. The runner rejects multiple workers in memory mode. Use the runner rather than invoking Uvicorn directly.

Setting `REDIS_URL` switches to Redis storage:

```sh
docker compose up -d
REDIS_URL=redis://localhost:6379/0 uv run python -m outpost --workers 4
```

The runner also accepts `--host`, `--port` (default: 9000), and `--reload`.
Redis connections are initialized and closed during the application lifespan.

## Benchmark

Run the HTTP ingest benchmark against a running Outpost server:

```sh
uv run python benchmark.py
uv run python benchmark.py --batch-size 1000 --concurrency 8 --requests 2000
uv run python benchmark.py --batch-size 10 --concurrency 32 --requests 20000 --processes 4
```

Reports requests/s, events/s, and mean/p50/p95/p99 response time.

Uses up to four client processes by default, capped by concurrency and request count.
Requests, concurrency, and warmup are totals split across processes. Each process warms up before a synchronized start; timings exclude startup and warmup. Use `--processes 1` to compare against a single client process.
