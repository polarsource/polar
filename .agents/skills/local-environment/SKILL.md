---
name: local-environment
description: Local development environment management for Polar using Docker
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Local Environment Skill

This skill enables Claude to help manage the Polar local development environment using Docker. Use this when the user needs to start, stop, debug, or understand the local development stack.

## Instance Auto-Detection

The `dev docker` command **automatically detects** the correct instance number. No manual `-i` flag is needed in most cases.

**Detection priority:**
1. `CONDUCTOR_PORT` env var → `(port - 55000) / 10 + 1`
2. Workspace path hash → stable instance derived from the repo root path

You can override with `-i N` if needed, but auto-detection handles Conductor workspaces automatically.

## When to Use

- User asks to start/stop the local environment
- User needs to view logs or debug issues
- User wants to run multiple isolated instances
- User needs to understand the service architecture
- User encounters container or service errors

## Quick Reference

| Task | Command |
|------|---------|
| Start full stack | `dev docker up -d` |
| Stop services | `dev docker down` |
| View all logs | `dev docker logs` |
| View service logs | `dev docker logs {service}` |
| Follow logs | `dev docker logs -f` |
| Check status | `dev docker ps` |
| Restart service | `dev docker restart {service}` |
| Shell access | `dev docker shell {service}` |
| Fresh start | `dev docker cleanup -f && dev docker up -d` |
| With monitoring | `dev docker up --monitoring -d` |
| Force rebuild | `dev docker up -b -d` |

## Services

| Service | Default Port | Description |
|---------|-------------|-------------|
| api | 8000 | FastAPI backend |
| worker | - | Background job processor |
| web | 3000 | Next.js frontend |
| db | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| minio | 9000/9001 | S3-compatible storage |
| prometheus | 9090 | Metrics (optional) |
| grafana | 3001 | Dashboards (optional) |

## Instance Port Mapping

Port = Base Port + (Instance × 100)

| Instance | API | Web | DB | Redis | MinIO |
|----------|-----|-----|-----|-------|-------|
| 0 | 8000 | 3000 | 5432 | 6379 | 9000 |
| 1 | 8100 | 3100 | 5532 | 6479 | 9100 |
| 2 | 8200 | 3200 | 5632 | 6579 | 9200 |

## Rules Index

| Rule | Category | Description |
|------|----------|-------------|
| [service-architecture](rules/service-architecture.md) | Reference | Service details |
