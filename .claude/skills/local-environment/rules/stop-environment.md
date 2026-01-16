---
title: Stopping the Local Environment
category: Operations
tags: docker, stop, cleanup
---

# Stopping the Local Environment

## Stop Services

**Stop all services:**
```bash
./dev/docker-dev down
```

This stops and removes containers but preserves data volumes.

**Stop specific instance:**
```bash
./dev/docker-dev -i 1 down
```

## Complete Cleanup

**Remove containers AND volumes (fresh start):**
```bash
./dev/docker-dev cleanup
```

**WARNING**: This deletes:
- Database data
- Uploaded files (MinIO)
- Redis cache
- All stored state

Use cleanup when:
- Starting fresh
- Fixing corrupted data
- Testing initial setup
- Changing database schema significantly

## Restart vs Stop

**Restart (keeps containers, faster):**
```bash
./dev/docker-dev restart
./dev/docker-dev restart api
```

**Stop/Start (recreates containers):**
```bash
./dev/docker-dev down
./dev/docker-dev -d
```

Prefer restart for quick changes. Use stop/start when:
- Changing Docker configuration
- Updating environment variables
- Containers are in bad state
