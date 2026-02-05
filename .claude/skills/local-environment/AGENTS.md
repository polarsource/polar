# Local Environment Management - Complete Guide

This document provides comprehensive instructions for Claude to manage the Polar local development environment using Docker.

## Instance Auto-Detection

The `dev docker` command **automatically detects** the correct instance number. No manual `-i` flag is needed.

**Detection priority:**
1. `CONDUCTOR_PORT` env var → `(port - 55000) / 10 + 1`
2. Workspace path hash → stable instance derived from the repo root path

You can override with `-i N` if needed, but just running `dev docker up -d` will auto-detect the right instance.

---

## Overview

The Polar development environment runs as a Docker Compose stack with:

- **Backend**: Python/FastAPI API server + background worker
- **Frontend**: Next.js web application
- **Infrastructure**: PostgreSQL, Redis, MinIO (S3-compatible storage)
- **Optional Monitoring**: Prometheus + Grafana

All management is done through the `dev docker` CLI command.

---

## 1. Starting the Environment

### Basic Start (Foreground)

```bash
dev docker up
```

This starts all services and shows logs in the terminal. Use Ctrl+C to stop.

### Background Start (Recommended)

```bash
dev docker up -d
```

Starts in detached mode. Services continue running after terminal closes.

### Start Specific Services

```bash
dev docker up api              # API only (includes db, redis, minio)
dev docker up web              # Web only (includes api dependencies)
dev docker up api worker       # API and worker
dev docker up -d api web       # API and web in background
```

### Start with Monitoring

```bash
dev docker up --monitoring -d
```

Includes Prometheus (port 9090) and Grafana (port 3001, login: admin/polar).

### Force Rebuild Images

```bash
dev docker up -b -d
```

Rebuilds Docker images before starting. Use after Dockerfile changes.

---

## 2. Stopping the Environment

### Stop All Services

```bash
dev docker down
```

Stops and removes containers but preserves volumes (data persists).

### Stop Specific Instance

```bash
dev docker down -i 1    # Stop instance 1
```

### Complete Cleanup (Fresh Start)

```bash
dev docker cleanup
```

**WARNING**: This removes all containers AND volumes. Database and file storage will be reset.

---

## 3. Viewing Logs

### All Services (Last Output)

```bash
dev docker logs
```

### Follow Logs (Real-Time)

```bash
dev docker logs -f
```

### Specific Service Logs

```bash
dev docker logs api        # API logs
dev docker logs worker     # Worker logs
dev docker logs web        # Frontend logs
dev docker logs db         # Database logs
dev docker logs -f api     # Follow API logs (default)
```

### Don't Follow (Exit Immediately)

```bash
dev docker logs --no-follow
```

---

## 4. Checking Status

### List Running Containers

```bash
dev docker ps
```

Shows container names, status, and port mappings.

### Check Specific Instance

```bash
dev docker ps -i 1
```

---

## 5. Managing Instances

### What Are Instances?

Instances allow running multiple isolated development environments simultaneously. Each instance:

- Uses different ports (offset by instance × 100)
- Has its own database and storage
- Runs in separate Docker containers
- Uses project name `polar-dev-{instance}`

### Port Mapping Formula

```
Port = Base Port + (Instance Number × 100)
```

| Service       | Base | Instance 0 | Instance 1 | Instance 2 |
| ------------- | ---- | ---------- | ---------- | ---------- |
| API           | 8000 | 8000       | 8100       | 8200       |
| Web           | 3000 | 3000       | 3100       | 3200       |
| DB            | 5432 | 5432       | 5532       | 5632       |
| Redis         | 6379 | 6379       | 6479       | 6579       |
| MinIO API     | 9000 | 9000       | 9100       | 9200       |
| MinIO Console | 9001 | 9001       | 9101       | 9201       |
| Prometheus    | 9090 | 9090       | 9190       | 9290       |
| Grafana       | 3001 | 3001       | 3101       | 3201       |

### Start Instance

```bash
dev docker up -i 1 -d        # Start instance 1
dev docker up -i 2 -d        # Start instance 2
```

### Manage Instance

```bash
dev docker logs -i 1          # View instance 1 logs
dev docker ps -i 1            # Check instance 1 status
dev docker down -i 1          # Stop instance 1
dev docker cleanup -i 1       # Reset instance 1
```

### Running Multiple Instances

```bash
# Terminal 1
dev docker up -i 0 -d

# Terminal 2
dev docker up -i 1 -d

# Both running independently
# Instance 0: http://localhost:3000 (web), http://localhost:8000 (api)
# Instance 1: http://localhost:3100 (web), http://localhost:8100 (api)
```

---

## 6. Container Shell Access

### Open Shell in Container

```bash
dev docker shell api      # Python environment
dev docker shell worker   # Python environment
dev docker shell web      # Node environment
dev docker shell db       # PostgreSQL container
```

### Useful Commands Inside Containers

**API/Worker Container:**

```bash
uv run task test              # Run tests
uv run alembic upgrade head   # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run python -c "..."        # Run Python code
```

**Web Container:**

```bash
pnpm test                     # Run frontend tests
pnpm build                    # Build frontend
pnpm lint                     # Run linter
```

**DB Container:**

```bash
psql -U polar -d polar        # Connect to database
```

---

## 7. Restarting Services

### Restart All Services

```bash
dev docker restart
```

### Restart Specific Service

```bash
dev docker restart api
dev docker restart worker
dev docker restart web
```

**When to Restart:**

- After pulling new code (hot-reload handles most changes)
- After changing environment variables
- After container crashes
- When hot-reload fails to pick up changes

---

## 8. Building Images

### Rebuild All Images

```bash
dev docker build
```

### Rebuild Specific Service

```bash
dev docker build api
dev docker build web
```

### Start with Rebuild

```bash
dev docker up -b -d
```

**When to Rebuild:**

- After changing Dockerfile
- After changing system dependencies
- After changing Python version
- When encountering strange dependency issues

---

## 9. Service Architecture

### Infrastructure Services

**db (PostgreSQL 15.1)**

- Primary database
- Port: 5432 (default)
- Credentials: polar/polar
- Data persisted in `postgres_data` volume
- Health check: `pg_isready`

**redis (Redis Alpine)**

- Cache and job queue backend
- Port: 6379 (default)
- Health check: `redis-cli ping`

**minio (S3-Compatible Storage)**

- File storage (images, downloads, etc.)
- API Port: 9000
- Console Port: 9001
- Credentials: polar/polarpolar
- Data persisted in `minio_data` volume
- Buckets: `polar-s3`, `polar-s3-public`

### Application Services

**api (FastAPI Backend)**

- Python 3.14 with uvicorn
- Port: 8000 (default)
- Hot-reload enabled
- Depends on: db, redis, minio
- Runs migrations on startup
- Loads seed data on first run

**worker (Background Jobs)**

- Dramatiq with 3 queues: high/medium/low priority
- No exposed port
- Hot-reload enabled
- Depends on: db, redis, minio, api
- Shares code with API container

**web (Next.js Frontend)**

- Node 24 with Turbopack
- Port: 3000 (default)
- Hot-reload enabled
- Memory limit: 4GB
- Depends on: api

### Optional Services

**prometheus (Metrics)**

- Port: 9090
- 1-day retention
- Enable with: `--monitoring`

**grafana (Dashboards)**

- Port: 3001
- Credentials: polar/polar
- Pre-configured dashboards
- Enable with: `--monitoring`

---

## 10. Environment Configuration

### Environment Files

**`dev/docker/.env.docker`** - Docker-specific overrides (auto-created from template)

**`server/.env`** - Backend secrets (GitHub, Stripe, etc.)

### Key Environment Variables

```bash
# Database
POLAR_POSTGRES_USER=polar
POLAR_POSTGRES_PWD=polar
POLAR_POSTGRES_DATABASE=polar

# MinIO
POLAR_MINIO_USER=polar
POLAR_MINIO_PWD=polarpolar

# S3
POLAR_AWS_ACCESS_KEY_ID=polar-development
POLAR_AWS_SECRET_ACCESS_KEY=polar123456789
POLAR_S3_FILES_BUCKET_NAME=polar-s3
```

### Accessing Services Internally

Services use Docker network hostnames:

- Database: `db:5432`
- Redis: `redis:6379`
- MinIO: `minio:9000`
- API: `api:8000`

---

## 11. Troubleshooting

### Service Won't Start

1. Check if ports are in use:

    ```bash
    lsof -i :8000    # Check if API port is in use
    lsof -i :3000    # Check if web port is in use
    ```

2. Check Docker is running:

    ```bash
    docker info
    ```

3. Check logs for errors:

    ```bash
    dev docker logs api
    ```

4. Try cleanup and restart:
    ```bash
    dev docker down
    dev docker up -d
    ```

### Database Connection Failed

1. Check db container is healthy:

    ```bash
    dev docker ps
    ```

2. Wait for health check (takes ~40 seconds on first start)

3. Check db logs:
    ```bash
    dev docker logs db
    ```

### Hot-Reload Not Working

1. Check file is being mounted:

    ```bash
    dev docker shell api
    ls -la /app/server/polar/
    ```

2. Restart the service:

    ```bash
    dev docker restart api
    ```

3. Rebuild if needed:
    ```bash
    dev docker build api
    dev docker restart api
    ```

### Out of Memory

1. Check Docker memory allocation (should be 8GB+)

2. Stop unused instances:

    ```bash
    dev docker down -i 1
    dev docker down -i 2
    ```

3. Clear unused Docker resources:
    ```bash
    docker system prune
    ```

### MinIO/S3 Issues

1. Check minio-setup completed:

    ```bash
    dev docker logs minio-setup
    ```

2. Access MinIO console: http://localhost:9001
    - Username: polar
    - Password: polarpolar

3. Verify buckets exist in console

### Frontend Build Errors

1. Clear Next.js cache:

    ```bash
    dev docker shell web
    rm -rf .next
    exit
    dev docker restart web
    ```

2. Reinstall dependencies:
    ```bash
    dev docker shell web
    pnpm install
    exit
    dev docker restart web
    ```

### Complete Reset

When all else fails:

```bash
dev docker cleanup -f
dev docker up -b -d
```

This removes all containers, volumes, and rebuilds from scratch.

---

## 12. Common Workflows

### Daily Development

```bash
# Start environment
dev docker up -d

# Check status
dev docker ps

# View logs as you work
dev docker logs api

# When done
dev docker down
```

### After Git Pull

```bash
# Usually hot-reload handles it, but if issues:
dev docker restart api worker

# If dependencies changed:
dev docker build api worker
dev docker restart api worker
```

### Running Tests

```bash
# Backend tests (in container)
dev docker shell api
uv run task test
exit

# Frontend tests (in container)
dev docker shell web
pnpm test
exit
```

### Database Operations

```bash
# Connect to database
dev docker shell api
uv run alembic upgrade head      # Run migrations
uv run alembic downgrade -1      # Rollback one migration
exit

# Direct SQL access
dev docker shell db
psql -U polar -d polar
```

### Debugging API Issues

```bash
# Follow API logs
dev docker logs api

# Enable SQL debugging (in server/.env)
# POLAR_SQLALCHEMY_DEBUG=1

# Restart API
dev docker restart api
```

---

## 13. Differences from Production

| Aspect      | Development        | Production        |
| ----------- | ------------------ | ----------------- |
| Source Code | Mounted from host  | Copied into image |
| Hot-Reload  | Enabled            | Disabled          |
| Debug Mode  | ON                 | OFF               |
| Database    | Local container    | Managed service   |
| S3          | MinIO              | AWS S3            |
| Ports       | Configurable       | Fixed             |
| Instances   | Multiple supported | Single deployment |

---

## 14. Quick Command Reference

| Task               | Command                              |
| ------------------ | ------------------------------------ |
| Start (foreground) | `dev docker up`                      |
| Start (background) | `dev docker up -d`                   |
| Start instance     | `dev docker up -i {n} -d`            |
| Stop               | `dev docker down`                    |
| Cleanup (reset)    | `dev docker cleanup`                 |
| Logs (all)         | `dev docker logs`                    |
| Logs (follow)      | `dev docker logs -f`                 |
| Logs (service)     | `dev docker logs {service}`          |
| Status             | `dev docker ps`                      |
| Restart            | `dev docker restart {service}`       |
| Shell              | `dev docker shell {service}`         |
| Rebuild            | `dev docker up -b -d`                |
| Monitoring         | `dev docker up --monitoring -d`      |
| Help               | `dev docker --help`                  |

---

## 15. Service URLs (Default Instance)

| Service       | URL                        |
| ------------- | -------------------------- |
| Web Frontend  | http://localhost:3000      |
| API           | http://localhost:8000      |
| API Docs      | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001      |
| Prometheus    | http://localhost:9090      |
| Grafana       | http://localhost:3001      |

For instance N, add N×100 to each port.
