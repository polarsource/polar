---
title: Starting the Local Environment
category: Operations
tags: docker, start, development
---

# Starting the Local Environment

`dev docker up` starts shared infra (if it isn't already running) plus this
worktree's app stack. It **defaults to detached** (`-d` is on by default), so
plain `dev docker up` returns once containers are created.

## Basic commands

**Start in background (the default):**
```bash
dev docker up -d
```

**Start and block until app services are healthy:**
```bash
dev docker up -d --wait
```
`--wait` returns only once api answers `/healthz` and web responds. Prefer it in
scripts and tooling so "up finished" means "actually serving" rather than "the
container was created" — on first boot the app keeps compiling and migrating for
a while after the container starts.

**Start in the foreground and stream logs:**
```bash
dev docker up --no-detach
```
Shared infra still starts detached; only the app stack is attached, so Ctrl+C
stops the app stack.

**Start specific services:**
```bash
dev docker up -d api            # api (+ shared infra)
dev docker up -d web            # web (+ shared infra)
dev docker up -d api worker     # api and worker
```

## Options

| Flag | Description |
|------|-------------|
| `-d` / `--detach` | Detached / background (default) |
| `--no-detach` | Foreground; stream app logs until you stop it |
| `--wait` | Block until app services are healthy (detached only) |
| `-b` / `--build` | Rebuild images before starting |
| `--pull` | Refresh base images before building (see below) |
| `--monitoring` | Include Prometheus and Grafana in shared infra |
| `--skip-tinybird` | Don't start Tinybird |
| `-i N` | Target instance N explicitly (usually auto-detected) |

## Rebuilding with fresh bases

```bash
dev docker up -b --pull -d
```

`-b` rebuilds the images, and `--pull` refreshes the base images first. Use
`--pull` after a `.python-version` bump or when a rebuild alone still boots the
old interpreter — a cached `FROM` layer can otherwise pin you to a stale base.
See troubleshooting for the "No interpreter found for Python X" symptom.

## First-time startup

First run is slow because it does real work inside the containers:

1. Build the api/web images
2. `uv sync` (api/worker) and `pnpm install` (web) — several minutes
3. Bootstrap the per-instance DB and MinIO buckets
4. Run migrations and load seed data
5. Services become healthy

`dev docker up -d --wait` is the cleanest way to wait this out.

## Finding the URLs

Ports are per-instance, so don't assume 3000/8000. Ask:

```bash
dev docker ports          # human-readable
dev docker ports --json   # for tooling
```

For instance 0 the app is at http://localhost:3000 (web) and
http://localhost:8000 (api, docs at `/docs`). Shared infra (db/redis/minio) has
no host port — reach it with `dev docker exec <service> ...`.
