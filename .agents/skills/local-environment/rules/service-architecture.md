---
title: Service Architecture Reference
category: Reference
tags: architecture, services, infrastructure
---

# Service Architecture Reference

Two Docker projects: shared infra (`polar-shared`, one per machine) and a
per-instance app stack (`polar-app-<N>`, one per worktree). Shared infra
publishes **no host ports** — reach it with `dev docker exec <service> ...`.

## Infrastructure services (project `polar-shared`)

### db (PostgreSQL 15.1)
- Primary database. Reached at `db:5432` on the `polar-shared` network.
- Credentials: `polar` / `polar`.
- One logical database per instance: `polar_dev_<N>`.
- Volume: `postgres_data`. Health check: `pg_isready`.

### redis (Redis Alpine)
- Cache and job-queue backend at `redis:6379`.
- One DB index per instance (`<N>`); launched with `--databases 100`.
- Health check: `redis-cli ping`.

### minio (S3-compatible storage)
- File storage at `minio:9000` (container) or `localhost:9000` (host).
- Console at `localhost:9001` with credentials `polar-development` / `polar123456789`.
- Per-instance buckets: `polar-s3-<N>`, `polar-s3-public-<N>`.
- Volume: `minio_data`.

### tinybird
- Analytics engine at `tinybird:7181` (admin `7182`). Token is auto-discovered
  from the running container on api startup.

## Application services (project `polar-app-<N>`)

### api (FastAPI backend)
- `python:3.14.6-slim` + uvicorn, hot-reload on.
- Host port: `8000` (instance 0) or `8100+N`.
- Healthcheck: `curl /healthz` (generous `start_period` covers first-boot sync +
  migrations + seed).
- Startup: `uv sync`, build email templates, bootstrap DB/buckets, run
  migrations, load seed data on first run.

### worker (background jobs)
- Same image as api. No host port.
- Dramatiq with the priority queues (`high_priority`, `medium_priority`,
  `low_priority`), hot-reload on.
- Waits for api before starting.

### web (Next.js frontend)
- `node:22-slim` + Turbopack, hot-reload on.
- Host port: `3000` (instance 0) or `3100+N`. Memory limit: 6 GB.
- Healthcheck via Node's built-in `fetch` (the image has no curl/wget).
- Waits for api to be **healthy** before starting (it proxies SSR to api).

## Optional monitoring (project `polar-shared`, `--monitoring`)

- **prometheus** — metrics, 1-day retention, at `prometheus:9090` (no host port).
- **grafana** — dashboards at `grafana:3000` internally, login `polar` / `polar`
  (no host port; port-forward if you need the UI).

## Container dependencies

```
minio-setup → minio (healthy)
api         → db, redis, minio-setup
worker      → api (started)
web         → api (healthy)
grafana     → prometheus
```

## Volume persistence

| Volume | Purpose |
|--------|---------|
| postgres_data | Database (shared) |
| minio_data | Files (shared) |
| server_uv_cache | Python package cache |
| api_venv / worker_venv | Per-service virtualenv |
| pnpm_store | Node package store |
| web_node_modules | Frontend deps |
| web_next_cache | Build cache |

## Networking

App containers join a per-instance `default` bridge plus `polar-shared`. Infra
is addressed by name (`db:5432`, `redis:6379`, `minio:9000`, `api:8000`). Web
stays off `polar-shared` so `http://api:8000` resolves to *this* instance's api.
