---
title: Troubleshooting Common Issues
category: Debugging
tags: troubleshooting, errors, fixes
---

# Troubleshooting Common Issues

## Service Won't Start

**Check if ports are in use:**
```bash
lsof -i :8000    # API port
lsof -i :3000    # Web port
lsof -i :5432    # Database port
```

**Verify Docker is running:**
```bash
docker info
```

**Check container logs:**
```bash
dev docker logs api
dev docker logs web
```

**Try stop and restart:**
```bash
dev docker down
dev docker up -d
```

## Database Connection Failed

**Wait for health check (up to 40 seconds on first start)**

**Check db container:**
```bash
dev docker ps
dev docker logs db
```

**Verify database is healthy:**
```bash
# Each instance has its own database: polar_dev_<instance-number>
dev docker exec db psql -U polar -d polar_dev_<N> -c "SELECT 1"
```

Shared infra (db/redis/minio) is on the `polar-shared` Docker network with no
host port — reach it through `dev docker exec` or `docker exec polar-shared-<svc>-1`.

## Hot-Reload Not Working

**Check file mounting:**
```bash
dev docker shell api
ls -la /app/server/polar/
```

**Restart the service:**
```bash
dev docker restart api
```

**If still broken, rebuild:**
```bash
dev docker build api
dev docker restart api
```

## Out of Memory

**Check Docker memory settings** (should be 8GB+)

**Stop unused instances:**
```bash
dev docker down -i 1
dev docker down -i 2
```

**Clean up Docker:**
```bash
docker system prune
```

### `ERR_PNPM_ENOMEM` on first `dev docker up`

On a fresh worktree the api container (building the email renderer) and the
web container (installing frontend deps) can both run `pnpm install` at the
same time and OOM. Symptom in `docker logs polar-app-<N>-api-1`:

```
ERR_PNPM_ENOMEM  ENOMEM: not enough memory, copyfile ...
```

`docker ps` then shows api/web with `Exited (1)` while worker is still `Up`.

**Fix — restart the failed containers, pnpm resumes from its cache:**

```bash
docker start polar-app-<N>-api-1 polar-app-<N>-web-1
```

Wait for `/healthz` on the API port (printed by `dev docker up`) to come up
before continuing. Bumping Docker Desktop's memory above 8 GB or starting
services one at a time (`dev docker up -d api`, then `web`) also avoids the
clash.

## MinIO/S3 Issues

**Check minio-setup logs:**
```bash
dev docker logs minio-setup
```

**Access MinIO console:**
- URL: http://localhost:9001
- User: polar
- Password: polarpolar

**Verify buckets exist in console UI**

## Frontend Build Errors

**Clear Next.js cache:**
```bash
dev docker shell web
rm -rf .next
exit
dev docker restart web
```

**Reinstall dependencies:**
```bash
dev docker shell web
pnpm install
exit
dev docker restart web
```

## Migration Issues

**Check current migration state:**
```bash
dev docker shell api
uv run alembic current
```

**Run pending migrations:**
```bash
uv run alembic upgrade head
```

**Rollback if needed:**
```bash
uv run alembic downgrade -1
```

## Stale Connections After Shared DB Recycle

If `polar-shared-db-1` was recreated (e.g. you ran `dev docker down` on the
shared stack, or it was replaced by an unrelated `docker compose` run), the
running api/worker still hold connections to the old container and surface
errors like:

```
asyncpg.exceptions._base.InterfaceError: connection is closed
sqlalchemy.dialects.postgresql.asyncpg.InterfaceError
```

**Fix — restart api and worker so the pool reconnects:**

```bash
docker restart polar-app-<N>-api-1 polar-app-<N>-worker-1
```

## Don't Mix `dev docker` and Bare `docker compose`

`dev docker` runs the shared infra under the project name `polar-shared` on
the `polar-shared` network. Running `cd server && docker compose up` from the
same checkout creates a parallel stack on `server_default` with `server-`
prefixed containers. They don't conflict by name, but: they double the
memory footprint, `docker ps` shows two of everything, and a later
`docker compose down` on one stack will leave the other half running with
broken cross-network references.

Pick one. For everything in this skill, prefer `dev docker`.

## Complete Reset

**When all else fails:**
```bash
dev docker cleanup -f
dev docker up -b -d
```

This removes all data and rebuilds from scratch.

## Getting Help

1. Check logs: `dev docker logs`
2. Check status: `dev docker ps`
3. Check Docker: `docker info`
4. Try restart: `dev docker restart`
5. Try cleanup: `dev docker cleanup`
