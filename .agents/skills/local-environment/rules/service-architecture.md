---
title: Service Architecture Reference
category: Reference
tags: architecture, services, infrastructure
---

# Service Architecture Reference

## Infrastructure Services

### db (PostgreSQL 15.1)

- **Purpose:** Primary database (shared infrastructure)
- **Port:** No host port (access via `dev docker exec db`)
- **Credentials:** polar/polar
- **Volume:** postgres_data
- **Health check:** pg_isready (2s interval)
- **Per-instance:** Each instance gets its own database `polar_dev_<N>`

### redis (Redis Alpine)

- **Purpose:** Cache and job queue backend (shared infrastructure)
- **Port:** No host port (access via `dev docker exec redis`)
- **Health check:** redis-cli ping
- **Per-instance:** Each instance uses its own DB index

### minio (S3-Compatible Storage)

- **Purpose:** File storage (shared infrastructure)
- **Ports:** No host ports (access via `dev docker exec minio`)
- **Credentials:** polar-development/polar123456789
- **Volume:** minio_data
- **Per-instance:** Each instance gets its own bucket pair `polar-s3-<N>`, `polar-s3-public-<N>`

## Application Services

### api (FastAPI Backend)

- **Purpose:** REST API server
- **Port:** 8000
- **Image:** Python 3.14 + uvicorn
- **Hot-reload:** Enabled
- **Startup tasks:**
    - Sync dependencies
    - Build email templates
    - Run migrations
    - Load seed data

### worker (Background Jobs)

- **Purpose:** Async task processing
- **Image:** Same as API
- **Queues:** high_priority, medium_priority, low_priority
- **Hot-reload:** Enabled
- **Depends on:** API (waits for initialization)

### web (Next.js Frontend)

- **Purpose:** User interface
- **Port:** 3000
- **Image:** Node 24 + Turbopack
- **Memory limit:** 4GB
- **Hot-reload:** Enabled

## Optional Monitoring

### prometheus

- **Purpose:** Metrics collection (shared infrastructure)
- **Port:** No host port (access via `dev docker exec prometheus`)
- **Retention:** 1 day
- **Enable:** --monitoring flag

### grafana

- **Purpose:** Dashboards (shared infrastructure)
- **Port:** No host port (access via `dev docker exec grafana`)
- **Credentials:** polar/polar
- **Enable:** --monitoring flag

## Container Dependencies

```
minio-setup → minio (healthy)
api → db (healthy), redis (healthy), minio-setup (complete)
worker → db, redis, minio-setup, api (started)
web → api (started)
grafana → prometheus (started)
```

## Volume Persistence

| Volume           | Purpose            |
| ---------------- | ------------------ |
| postgres_data    | Database           |
| minio_data       | Files              |
| server_uv_cache  | Python packages    |
| api_venv         | API virtual env    |
| worker_venv      | Worker virtual env |
| pnpm_store       | Node packages      |
| web_node_modules | Frontend deps      |
| web_next_cache   | Build cache        |

## Network

All services on internal Docker network using service names:

- `db:5432`
- `redis:6379`
- `minio:9000`
- `api:8000`
