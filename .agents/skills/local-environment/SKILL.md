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
| db | - (shared) | PostgreSQL database |
| redis | - (shared) | Redis cache |
| minio | - (shared) | S3-compatible storage |
| prometheus | - (shared) | Metrics (optional) |
| grafana | - (shared) | Dashboards (optional) |

## Instance Port Mapping

Port = Base Port + (Instance × 100). Only app services (API, Web) expose host ports. Shared infrastructure is accessed via `dev docker exec <service>`.

| Instance | API | Web |
|----------|-----|-----|
| 0 | 8000 | 3000 |
| 1 | 8100 | 3100 |
| 2 | 8200 | 3200 |

Shared infra (db/redis/minio/tinybird) runs under the `polar-shared` project
without host port mappings — reach it via `dev docker exec <service>` or
`docker exec polar-shared-<service>-1`. The per-instance database is named
`polar_dev_<N>`, not `polar`.

## Rules Index

| Rule | Category | Description |
|------|----------|-------------|
| [service-architecture](rules/service-architecture.md) | Reference | Service details |
| [start-environment](rules/start-environment.md) | Operations | Starting the stack |
| [stop-environment](rules/stop-environment.md) | Operations | Stopping the stack |
| [manage-instances](rules/manage-instances.md) | Operations | Running parallel instances |
| [view-logs](rules/view-logs.md) | Debugging | Viewing service logs |
| [troubleshooting](rules/troubleshooting.md) | Debugging | Common errors and fixes |
| [payment-testing](rules/payment-testing.md) | Operations | Login codes, Stripe webhooks, dramatiq actors, backoffice |
