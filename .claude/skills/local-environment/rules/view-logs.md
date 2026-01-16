---
title: Viewing Service Logs
category: Debugging
tags: logs, debugging, troubleshooting
---

# Viewing Service Logs

## Commands

**View all logs (last output):**
```bash
./dev/docker-dev logs
```

**Follow logs in real-time:**
```bash
./dev/docker-dev logs -f
```

**Specific service logs:**
```bash
./dev/docker-dev logs api
./dev/docker-dev logs worker
./dev/docker-dev logs web
./dev/docker-dev logs db
./dev/docker-dev logs redis
./dev/docker-dev logs minio
```

**Follow specific service:**
```bash
./dev/docker-dev logs -f api
```

**Instance-specific logs:**
```bash
./dev/docker-dev -i 1 logs api
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
   ./dev/docker-dev logs -f api
   ```

2. **Check worker for background job issues:**
   ```bash
   ./dev/docker-dev logs -f worker
   ```

3. **Database issues - check db:**
   ```bash
   ./dev/docker-dev logs db
   ```

4. **Startup issues - check all:**
   ```bash
   ./dev/docker-dev logs
   ```
