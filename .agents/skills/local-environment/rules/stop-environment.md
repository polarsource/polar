---
title: Stopping the Local Environment
category: Operations
tags: docker, stop, cleanup
---

# Stopping the Local Environment

Commands act on **this instance's app stack** by default; the shared infra
(postgres/redis/minio/tinybird) keeps running so other worktrees aren't
disrupted. Reach for the shared stack explicitly only when you mean to.

## Stop services

**Stop this instance's app stack (keeps data + shared infra):**
```bash
dev docker down
```

**Stop the app stack and the shared infra too:**
```bash
dev docker down --all
```

**Stop a specific instance:**
```bash
dev docker down -i 1
```

## Cleanup (destructive)

**Reset this instance** — removes its api/worker/web containers and their
build/cache volumes. Shared infra and its data are left intact:
```bash
dev docker cleanup -f
```

**Wipe everything shared** — this destroys postgres data, MinIO objects,
Tinybird events, and prometheus/grafana state for **every** instance on the
machine:
```bash
dev docker cleanup --all -f
```

Use per-instance cleanup for a fresh app stack; use `--all` only when you truly
want to reset the machine-wide data. To drop just one instance's DB/buckets
without touching others, delete its worktree and run `dev docker prune`.

## Restart vs stop/start

**Restart (keeps containers, fastest):**
```bash
dev docker restart          # all app services
dev docker restart api      # one service
```

**Stop/start (recreates containers):**
```bash
dev docker down
dev docker up -d
```

Prefer `restart` for quick changes. Recreate when you've changed Docker config,
environment variables, or a container is wedged.
