---
title: Managing Multiple Instances
category: Operations
tags: instances, parallel, isolation
---

# Managing Multiple Instances

## What Are Instances?

Instances allow running multiple isolated development environments simultaneously. Each instance:
- Uses different ports for app services (offset by instance × 100)
- Has its own database on shared PostgreSQL server
- Has its own Redis DB index on shared Redis server
- Has its own S3 bucket pair on shared MinIO server
- Runs independently

## Port Mapping

Only app services (API, Web) expose host ports. Shared infrastructure (PostgreSQL, Redis, MinIO) is accessed via `dev docker exec <service>`.

| Service | Instance 0 | Instance 1 | Instance 2 |
|---------|------------|------------|------------|
| Web | 3000 | 3100 | 3200 |
| API | 8000 | 8100 | 8200 |

**Formula:** Port = Base + (Instance × 100)

## Commands

**Start instance:**
```bash
dev docker up -i 1 -d
dev docker up -i 2 -d
```

**Check instance status:**
```bash
dev docker ps -i 1
```

**View instance logs:**
```bash
dev docker logs -i 1 api
```

**Stop instance:**
```bash
dev docker down -i 1
```

**Shell into instance:**
```bash
dev docker shell -i 1 api
```

## Use Cases

1. **Testing different branches:**
   - Instance 0: main branch
   - Instance 1: feature branch

2. **Running parallel tests:**
   - Instance 0: development
   - Instance 1: running test suite

3. **Comparing behavior:**
   - Instance 0: before changes
   - Instance 1: after changes

## Resource Considerations

Each instance uses:
- ~2GB memory for full stack
- Separate disk space for volumes
- Independent CPU allocation

Limit to 2-3 instances on typical development machines.
