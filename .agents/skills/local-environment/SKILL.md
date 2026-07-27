---
name: local-environment
description: Local development environment management for Polar using Docker
license: MIT
metadata:
  author: polar
  version: "1.1.0"
---

# Local Environment Skill

Helps manage the Polar local development environment through the `dev docker`
CLI. Use it to start, stop, debug, or reason about the local stack.

## The two-part model

`dev docker` deliberately splits the stack so many worktrees can share one set
of heavy infra:

- **Shared infra** — one copy per machine, Docker project `polar-shared`:
  postgres, redis, minio, tinybird, and optional prometheus/grafana. Postgres
  and redis publish no host ports; MinIO exposes 9000/9001 for browser
  uploads. Use `dev docker exec <service> ...` for services without host ports.
- **Per-instance app stack** — one per worktree, project `polar-app-<N>`: api,
  worker, web. Only **api and web** publish host ports, offset per instance so
  worktrees don't collide.

Knowing this prevents the most common confusion: there is no `localhost:5432`
for the database (it lives in the shared stack and is reached through
`dev docker exec db ...`). MinIO does expose ports 9000/9001 for browser
uploads and console access.

## Instance auto-detection

`dev docker` auto-detects the instance for the current worktree, so `-i` is
rarely needed. Priority:

1. `POLAR_DOCKER_INSTANCE` pinned in `dev/docker/.env.docker` (`dev docker set-instance N`)
2. `CONDUCTOR_PORT` env var → `(port - 55000) / 10 + 1`
3. The cross-worktree registry (`~/.config/polar/docker-instances.json`)
4. Otherwise the lowest free number, then registered

Run `dev docker ports` to see the resolved instance and its URLs (add `--json`
for tooling). To wire this worktree into Claude Code's preview, run
`dev docker launch-json`, which writes a per-instance `.claude/launch.json` with
the correct ports (it's gitignored, so regenerate after `set-instance`).

## When to use

- Start / stop / restart the local environment
- View logs or debug a service that won't come up
- Run several isolated worktree instances in parallel
- Understand the service architecture or find a service's real port
- Diagnose container or first-boot errors

## Quick reference

| Task | Command |
|------|---------|
| Start full stack (background) | `dev docker up -d` |
| Start and block until healthy | `dev docker up -d --wait` |
| Start in foreground (stream logs) | `dev docker up --no-detach` |
| Rebuild with fresh base images | `dev docker up -b --pull -d` |
| Show this instance's ports/URLs | `dev docker ports` (`--json` for tooling) |
| Write Claude Code preview config | `dev docker launch-json` |
| Stop app stack | `dev docker down` |
| Stop app **and** shared infra | `dev docker down --all` |
| Follow logs | `dev docker logs -f [service]` |
| Print logs and exit | `dev docker logs --no-follow [service]` |
| Status | `dev docker ps` |
| Restart a service | `dev docker restart <service>` |
| Shell into a service | `dev docker shell <service>` |
| One-off command in a service | `dev docker exec <service> <cmd>` |
| Reset this instance | `dev docker cleanup -f` |
| Wipe ALL shared data | `dev docker cleanup --all -f` |
| List every instance | `dev docker list` |
| With monitoring | `dev docker up --monitoring -d` |

## Services

| Service | Project | Host port (instance 0 / N) | Notes |
|---------|---------|----------------------------|-------|
| api | `polar-app-<N>` | 8000 / 8100+N | FastAPI; `/healthz` healthcheck |
| web | `polar-app-<N>` | 3000 / 3100+N | Next.js; healthchecked |
| worker | `polar-app-<N>` | none | Background jobs |
| db | `polar-shared` | none (`exec`) | PostgreSQL; DB `polar_dev_<N>` |
| redis | `polar-shared` | none (`exec`) | Redis DB index = N |
| minio | `polar-shared` | 9000, 9001 | S3; buckets `polar-s3-<N>`; console at 9001 |
| tinybird | `polar-shared` | none (`exec`) | Analytics |
| prometheus / grafana | `polar-shared` | none (`exec`) | `--monitoring` only |

Discover the exact host ports for the current worktree with `dev docker ports`.

## Instance port mapping

Only api and web get host ports: `Port = Base + Instance` (Base 8100 for api,
3100 for web) for instances 1–99. Instance 0 uses the legacy `8000` / `3000`.

| Instance | API | Web |
|----------|-----|-----|
| 0 | 8000 | 3000 |
| 1 | 8101 | 3101 |
| 2 | 8102 | 3102 |
| 5 | 8105 | 3105 |

Everything else is per-instance but not on a host port: database `polar_dev_<N>`,
redis DB index `<N>`, buckets `polar-s3-<N>` / `polar-s3-public-<N>`. Reach them
via `dev docker exec <service>` or `docker exec polar-shared-<service>-1`.

## Rules index

| Rule | Category | Description |
|------|----------|-------------|
| [service-architecture](rules/service-architecture.md) | Reference | Service details, ports, healthchecks |
| [start-environment](rules/start-environment.md) | Operations | Starting the stack (flags, `--wait`, `--pull`) |
| [stop-environment](rules/stop-environment.md) | Operations | Stopping and cleanup (app vs shared) |
| [manage-instances](rules/manage-instances.md) | Operations | Parallel worktree instances |
| [view-logs](rules/view-logs.md) | Debugging | Viewing service logs |
| [shell-and-workflows](rules/shell-and-workflows.md) | Operations | Shell access and common dev workflows |
| [troubleshooting](rules/troubleshooting.md) | Debugging | Common errors and fixes |
| [payment-testing](rules/payment-testing.md) | Operations | Login codes, Stripe webhooks, backoffice |
