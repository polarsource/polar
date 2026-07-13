---
title: Managing Multiple Instances
category: Operations
tags: instances, parallel, isolation
---

# Managing Multiple Instances

## What are instances?

An instance is one worktree's isolated app stack (project `polar-app-<N>`). All
instances share a single infra stack (`polar-shared`), but each gets:

- Its own api/web **host ports** (offset per instance)
- Its own database `polar_dev_<N>` on the shared postgres
- Its own redis DB index `<N>` on the shared redis
- Its own S3 buckets `polar-s3-<N>` / `polar-s3-public-<N>` on the shared minio

So instances are cheap: only api/worker/web containers are duplicated, not the
infra.

## Port mapping

Only api and web publish host ports. Everything else is shared and reached by
container name, so there is **no** per-instance `5532`/`6479`/`9100` — those
ports don't exist in this model.

| Service | Instance 0 | Instance 1 | Instance 2 |
|---------|------------|------------|------------|
| API (host) | 8000 | 8100 | 8200 |
| Web (host) | 3000 | 3100 | 3200 |
| DB (logical) | `polar_dev_0` | `polar_dev_1` | `polar_dev_2` |
| Redis (DB index) | 0 | 1 | 2 |
| S3 bucket | `polar-s3-0` | `polar-s3-1` | `polar-s3-2` |

**Host-port formula (api/web only):** `Port = Base + (Instance × 100)`, for
instances 1–99. Instance 0 uses the legacy `8000`/`3000`.

Run `dev docker ports` in a worktree to print its resolved instance and URLs.

## Pinning and inspecting instances

Auto-detection usually picks the right instance, but you can pin or inspect:

```bash
dev docker set-instance 5     # pin this worktree to instance 5 (writes .env.docker + registry)
dev docker clear-instance     # back to auto-detect
dev docker list               # every registered instance: number, status, path
dev docker prune              # drop registry entries whose worktree is gone, and their data
```

Pinning makes ports deterministic, which is what you want when wiring a worktree
into tooling like `.claude/launch.json`.

## Commands (explicit instance)

Most commands auto-detect, but `-i N` targets one explicitly:

```bash
dev docker up -i 1 -d       # start instance 1
dev docker ps -i 1          # status
dev docker logs -i 1 api    # logs
dev docker down -i 1        # stop
dev docker shell -i 1 api   # shell
```

## Use cases

- **Branch A vs branch B** side by side, each in its own worktree.
- **Run a long test suite** in one instance while developing in another.
- **Before/after comparisons** without tearing down your main stack.

## Resource notes

Each app stack adds ~2 GB and its own build/cache volumes; the shared infra is
paid once. Two or three instances is comfortable on a typical machine. Use
`dev docker prune` to reclaim data from worktrees you've deleted.
