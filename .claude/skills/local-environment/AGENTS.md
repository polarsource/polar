# Local Environment Management - Complete Guide

This document provides comprehensive instructions for Claude to manage the Polar local development environment using Docker.

## CRITICAL: Conductor Instance Detection

**ALWAYS check `CONDUCTOR_PORT` first before running any docker-dev commands:**

```bash
echo $CONDUCTOR_PORT
```

**Instance Calculation:**

- If `CONDUCTOR_PORT` is **not set**: Not running in Conductor, use instance 0
- If `CONDUCTOR_PORT` is **set**: `INSTANCE=$((CONDUCTOR_PORT - 55090))`

| CONDUCTOR_PORT | Instance | API Port | Web Port |
| -------------- | -------- | -------- | -------- |
| 55090          | 0        | 8000     | 3000     |
| 55091          | 1        | 8100     | 3100     |
| 55092          | 2        | 8200     | 3200     |
| 55093          | 3        | 8300     | 3300     |

**All docker-dev commands must include `-i $INSTANCE`** to use the correct isolated environment when running in Conductor.

---

## Overview

The Polar development environment runs as a Docker Compose stack with:

- **Backend**: Python/FastAPI API server + background worker
- **Frontend**: Next.js web application
- **Infrastructure**: PostgreSQL, Redis, MinIO (S3-compatible storage)
- **Optional Monitoring**: Prometheus + Grafana

All management is done through the `./dev/docker-dev` script.

---

## 0. Conductor Integration (IMPORTANT)

**When running in Conductor, ALWAYS check `CONDUCTOR_PORT` first to determine the correct instance number:**

```bash
echo $CONDUCTOR_PORT
```

### Detecting Conductor Environment

- If `CONDUCTOR_PORT` is set → Running in Conductor app
- If not set → Not running in Conductor, use instance 0 or ask user

### Deriving Instance Number

```bash
# Formula: Extract last 2 digits, subtract 90, divide by 10
INSTANCE=$(( (${CONDUCTOR_PORT: -2} - 90) / 10 ))

# Examples:
# CONDUCTOR_PORT=55090 → instance 0
# CONDUCTOR_PORT=55190 → instance 1
# CONDUCTOR_PORT=55290 → instance 2
```

### Why This Matters

Each Conductor workspace runs in parallel and needs isolated Docker environments:

- Different database instances
- Different ports for API, web, etc.
- No conflicts between workspaces

### Recommended Pattern

```bash
# First, detect instance
if [ -n "$CONDUCTOR_PORT" ]; then
    INSTANCE=$(( (${CONDUCTOR_PORT: -2} - 90) / 10 ))
    echo "Running in Conductor, using instance $INSTANCE"
else
    INSTANCE=0
    echo "Not in Conductor, using default instance 0"
fi

# Then use instance in all commands
./dev/docker-dev -i $INSTANCE -d
./dev/docker-dev -i $INSTANCE logs -f api
./dev/docker-dev -i $INSTANCE ps
```

---

## 1. Starting the Environment

### Basic Start (Foreground)

```bash
./dev/docker-dev
```

This starts all services and shows logs in the terminal. Use Ctrl+C to stop.

### Background Start (Recommended)

```bash
./dev/docker-dev -d
```

Starts in detached mode. Services continue running after terminal closes.

### Start Specific Services

```bash
./dev/docker-dev api              # API only (includes db, redis, minio)
./dev/docker-dev web              # Web only (includes api dependencies)
./dev/docker-dev api worker       # API and worker
./dev/docker-dev -d api web       # API and web in background
```

### Start with Monitoring

```bash
./dev/docker-dev --monitoring -d
```

Includes Prometheus (port 9090) and Grafana (port 3001, login: admin/polar).

### Force Rebuild Images

```bash
./dev/docker-dev -b -d
```

Rebuilds Docker images before starting. Use after Dockerfile changes.

---

## 2. Stopping the Environment

### Stop All Services

```bash
./dev/docker-dev down
```

Stops and removes containers but preserves volumes (data persists).

### Stop Specific Instance

```bash
./dev/docker-dev -i 1 down    # Stop instance 1
```

### Complete Cleanup (Fresh Start)

```bash
./dev/docker-dev cleanup
```

**WARNING**: This removes all containers AND volumes. Database and file storage will be reset.

---

## 3. Viewing Logs

### All Services (Last Output)

```bash
./dev/docker-dev logs
```

### Follow Logs (Real-Time)

```bash
./dev/docker-dev logs -f
```

### Specific Service Logs

```bash
./dev/docker-dev logs api        # API logs
./dev/docker-dev logs worker     # Worker logs
./dev/docker-dev logs web        # Frontend logs
./dev/docker-dev logs db         # Database logs
./dev/docker-dev logs -f api     # Follow API logs
```

### Don't Follow (Exit Immediately)

```bash
./dev/docker-dev --no-follow logs
```

---

## 4. Checking Status

### List Running Containers

```bash
./dev/docker-dev ps
```

Shows container names, status, and port mappings.

### Check Specific Instance

```bash
./dev/docker-dev -i 1 ps
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
./dev/docker-dev -i 1 -d        # Start instance 1
./dev/docker-dev -i 2 -d        # Start instance 2
```

### Manage Instance

```bash
./dev/docker-dev -i 1 logs      # View instance 1 logs
./dev/docker-dev -i 1 ps        # Check instance 1 status
./dev/docker-dev -i 1 down      # Stop instance 1
./dev/docker-dev -i 1 cleanup   # Reset instance 1
```

### Running Multiple Instances

```bash
# Terminal 1
./dev/docker-dev -i 0 -d

# Terminal 2
./dev/docker-dev -i 1 -d

# Both running independently
# Instance 0: http://localhost:3000 (web), http://localhost:8000 (api)
# Instance 1: http://localhost:3100 (web), http://localhost:8100 (api)
```

---

## 6. Container Shell Access

### Open Shell in Container

```bash
./dev/docker-dev shell api      # Python environment
./dev/docker-dev shell worker   # Python environment
./dev/docker-dev shell web      # Node environment
./dev/docker-dev shell db       # PostgreSQL container
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
./dev/docker-dev restart
```

### Restart Specific Service

```bash
./dev/docker-dev restart api
./dev/docker-dev restart worker
./dev/docker-dev restart web
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
./dev/docker-dev build
```

### Rebuild Specific Service

```bash
./dev/docker-dev build api
./dev/docker-dev build web
```

### Start with Rebuild

```bash
./dev/docker-dev -b -d
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
    ./dev/docker-dev logs api
    ```

4. Try cleanup and restart:
    ```bash
    ./dev/docker-dev down
    ./dev/docker-dev -d
    ```

### Database Connection Failed

1. Check db container is healthy:

    ```bash
    ./dev/docker-dev ps
    ```

2. Wait for health check (takes ~40 seconds on first start)

3. Check db logs:
    ```bash
    ./dev/docker-dev logs db
    ```

### Hot-Reload Not Working

1. Check file is being mounted:

    ```bash
    ./dev/docker-dev shell api
    ls -la /app/server/polar/
    ```

2. Restart the service:

    ```bash
    ./dev/docker-dev restart api
    ```

3. Rebuild if needed:
    ```bash
    ./dev/docker-dev -b restart api
    ```

### Out of Memory

1. Check Docker memory allocation (should be 8GB+)

2. Stop unused instances:

    ```bash
    ./dev/docker-dev -i 1 down
    ./dev/docker-dev -i 2 down
    ```

3. Clear unused Docker resources:
    ```bash
    docker system prune
    ```

### MinIO/S3 Issues

1. Check minio-setup completed:

    ```bash
    ./dev/docker-dev logs minio-setup
    ```

2. Access MinIO console: http://localhost:9001
    - Username: polar
    - Password: polarpolar

3. Verify buckets exist in console

### Frontend Build Errors

1. Clear Next.js cache:

    ```bash
    ./dev/docker-dev shell web
    rm -rf .next
    exit
    ./dev/docker-dev restart web
    ```

2. Reinstall dependencies:
    ```bash
    ./dev/docker-dev shell web
    pnpm install
    exit
    ./dev/docker-dev restart web
    ```

### Complete Reset

When all else fails:

```bash
./dev/docker-dev cleanup
./dev/docker-dev -b -d
```

This removes all containers, volumes, and rebuilds from scratch.

---

## 12. Common Workflows

### Daily Development

```bash
# Start environment
./dev/docker-dev -d

# Check status
./dev/docker-dev ps

# View logs as you work
./dev/docker-dev logs -f api

# When done
./dev/docker-dev down
```

### After Git Pull

```bash
# Usually hot-reload handles it, but if issues:
./dev/docker-dev restart api worker

# If dependencies changed:
./dev/docker-dev -b restart api worker
```

### Running Tests

```bash
# Backend tests (in container)
./dev/docker-dev shell api
uv run task test
exit

# Frontend tests (in container)
./dev/docker-dev shell web
pnpm test
exit
```

### Database Operations

```bash
# Connect to database
./dev/docker-dev shell api
uv run alembic upgrade head      # Run migrations
uv run alembic downgrade -1      # Rollback one migration
exit

# Direct SQL access
./dev/docker-dev shell db
psql -U polar -d polar
```

### Debugging API Issues

```bash
# Follow API logs
./dev/docker-dev logs -f api

# Enable SQL debugging (in server/.env)
# POLAR_SQLALCHEMY_DEBUG=1

# Restart API
./dev/docker-dev restart api
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
| Start (foreground) | `./dev/docker-dev`                   |
| Start (background) | `./dev/docker-dev -d`                |
| Start instance     | `./dev/docker-dev -i {n} -d`         |
| Stop               | `./dev/docker-dev down`              |
| Cleanup (reset)    | `./dev/docker-dev cleanup`           |
| Logs (all)         | `./dev/docker-dev logs`              |
| Logs (follow)      | `./dev/docker-dev logs -f`           |
| Logs (service)     | `./dev/docker-dev logs {service}`    |
| Status             | `./dev/docker-dev ps`                |
| Restart            | `./dev/docker-dev restart {service}` |
| Shell              | `./dev/docker-dev shell {service}`   |
| Rebuild            | `./dev/docker-dev -b -d`             |
| Monitoring         | `./dev/docker-dev --monitoring -d`   |
| Help               | `./dev/docker-dev -h`                |

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
