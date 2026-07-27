---
title: Viewing Service Logs
category: Debugging
tags: logs, debugging, troubleshooting
---

# Viewing Service Logs

`dev docker logs` **follows by default** (`-f` is on). It auto-routes by service
name: app services (api/worker/web) come from this instance's `polar-app-<N>`
project, and infra services (db/redis/minio/...) from `polar-shared`.

## Commands

**Follow all app logs (the default):**
```bash
dev docker logs
```

**Print current logs and exit (don't follow):**
```bash
dev docker logs --no-follow
dev docker logs --no-follow api
```
Use `--no-follow` in scripts or when you just want a snapshot — otherwise the
command blocks streaming. (This maps to a foreground `docker compose logs`.)

**Specific service logs:**
```bash
dev docker logs api
dev docker logs worker
dev docker logs web
dev docker logs db       # auto-routed to polar-shared
dev docker logs redis
dev docker logs minio
```

**Follow a specific service:**
```bash
dev docker logs -f api
```

**Instance-specific logs:**
```bash
dev docker logs -i 1 api
```

## Log Interpretation

### API Logs

**Successful request:**
```
INFO: 127.0.0.1:54321 - "GET /api/v1/users HTTP/1.1" 200
```

**Error:**
```
ERROR: Exception in endpoint
Traceback (most recent call last):
  ...
```

### Worker Logs

**Task started:**
```
[dramatiq.MainProcess] Task started: polar.tasks.example:process
```

**Task completed:**
```
[dramatiq.MainProcess] Task completed in 0.123s
```

### Web Logs

**Page compiled:**
```
✓ Compiled /dashboard in 234ms
```

**Error:**
```
Error: Cannot find module 'xxx'
```

## Debugging Tips

1. **Follow API logs during development:**
   ```bash
   dev docker logs -f api
   ```

2. **Check worker for background job issues:**
   ```bash
   dev docker logs -f worker
   ```

3. **Database issues - check db:**
   ```bash
   dev docker logs db
   ```

4. **Startup issues - check all:**
   ```bash
   dev docker logs
   ```
