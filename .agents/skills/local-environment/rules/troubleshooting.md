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
dev docker shell db
psql -U polar -d polar -c "SELECT 1"
```

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
