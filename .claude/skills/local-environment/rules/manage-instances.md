---
title: Managing Multiple Instances
category: Operations
tags: instances, parallel, isolation
---

# Managing Multiple Instances

## What Are Instances?

Instances allow running multiple isolated development environments simultaneously. Each instance:
- Uses different ports (offset by instance × 100)
- Has its own database
- Has its own file storage
- Runs independently

## Port Mapping

| Service | Instance 0 | Instance 1 | Instance 2 |
|---------|------------|------------|------------|
| Web | 3000 | 3100 | 3200 |
| API | 8000 | 8100 | 8200 |
| DB | 5432 | 5532 | 5632 |
| Redis | 6379 | 6479 | 6579 |
| MinIO API | 9000 | 9100 | 9200 |
| MinIO Console | 9001 | 9101 | 9201 |

**Formula:** Port = Base + (Instance × 100)

## Commands

**Start instance:**
```bash
./dev/docker-dev -i 1 -d
./dev/docker-dev -i 2 -d
```

**Check instance status:**
```bash
./dev/docker-dev -i 1 ps
```

**View instance logs:**
```bash
./dev/docker-dev -i 1 logs -f api
```

**Stop instance:**
```bash
./dev/docker-dev -i 1 down
```

**Shell into instance:**
```bash
./dev/docker-dev -i 1 shell api
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
