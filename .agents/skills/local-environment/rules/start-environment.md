---
title: Starting the Local Environment
category: Operations
tags: docker, start, development
---

# Starting the Local Environment

Use `dev docker up` to start the Polar development environment.

## Basic Commands

**Start in background (recommended):**
```bash
dev docker up -d
```

**Start in foreground (see logs directly):**
```bash
dev docker up
```

**Start specific services:**
```bash
dev docker up api              # API only
dev docker up web              # Web only
dev docker up api worker       # API and worker
dev docker up -d api web       # API and web in background
```

## Options

| Flag | Description |
|------|-------------|
| `-d` | Detached mode (background) |
| `-b` | Force rebuild images before starting |
| `-i N` | Use instance N (different ports) |
| `--monitoring` | Include Prometheus and Grafana |

## Examples

```bash
# Full stack in background
dev docker up -d

# Rebuild and start
dev docker up -b -d

# Instance 1 with monitoring
dev docker up -i 1 --monitoring -d

# Just API for backend work
dev docker up -d api
```

## First-Time Startup

On first run:
1. Docker images are built (~5-10 minutes)
2. Dependencies are installed
3. Database migrations run
4. Seed data is loaded
5. Services become available

## Service URLs (after startup)

- Web: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- MinIO: http://localhost:9001
