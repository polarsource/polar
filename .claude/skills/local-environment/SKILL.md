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

## Conductor Integration

**CRITICAL:** When running in Conductor, always check `CONDUCTOR_PORT` first to determine the instance number:

```bash
echo $CONDUCTOR_PORT
```

- If `CONDUCTOR_PORT` is **not set** → Not running in Conductor, use instance 0
- If `CONDUCTOR_PORT` is **set** → Calculate instance: `INSTANCE=$((CONDUCTOR_PORT - 55090))`

| CONDUCTOR_PORT | Instance |
|----------------|----------|
| 55090 | 0 |
| 55091 | 1 |
| 55092 | 2 |
| 55093 | 3 |

**Always use `-i $INSTANCE` flag** with all docker-dev commands when running in Conductor.

## When to Use

- User asks to start/stop the local environment
- User needs to view logs or debug issues
- User wants to run multiple isolated instances
- User needs to understand the service architecture
- User encounters container or service errors

## Quick Reference

| Task | Command |
|------|---------|
| Start full stack | `./dev/docker-dev -i $INSTANCE -d` |
| Stop services | `./dev/docker-dev -i $INSTANCE down` |
| View all logs | `./dev/docker-dev -i $INSTANCE logs` |
| View service logs | `./dev/docker-dev -i $INSTANCE logs {service}` |
| Follow logs | `./dev/docker-dev -i $INSTANCE logs -f` |
| Check status | `./dev/docker-dev -i $INSTANCE ps` |
| Restart service | `./dev/docker-dev -i $INSTANCE restart {service}` |
| Shell access | `./dev/docker-dev -i $INSTANCE shell {service}` |
| Fresh start | `./dev/docker-dev -i $INSTANCE cleanup && ./dev/docker-dev -i $INSTANCE -d` |
| With monitoring | `./dev/docker-dev -i $INSTANCE --monitoring -d` |
| Force rebuild | `./dev/docker-dev -i $INSTANCE -b -d` |

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
