---
title: Stopping the Local Environment
category: Operations
tags: docker, stop, cleanup
---

# Stopping the Local Environment

## Stop Services

**Stop all services:**
```bash
dev docker down
```

This stops and removes containers but preserves data volumes.

**Stop specific instance:**
```bash
dev docker down -i 1
```

## Complete Cleanup

**Remove containers AND volumes (fresh start):**
```bash
dev docker cleanup
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
dev docker restart
dev docker restart api
```

**Stop/Start (recreates containers):**
```bash
dev docker down
dev docker up -d
```

Prefer restart for quick changes. Use stop/start when:
- Changing Docker configuration
- Updating environment variables
- Containers are in bad state
