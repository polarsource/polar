---
title: Shell Access and Common Workflows
category: Operations
tags: shell, exec, workflows, testing
---

# Shell Access and Common Workflows

## Shell into a container

```bash
dev docker shell api      # Python env (api)
dev docker shell worker   # Python env (worker)
dev docker shell web      # Node env
dev docker shell db       # postgres container (shared)
```

For one-off commands without an interactive shell, use `exec`:

```bash
dev docker exec api uv run alembic current
dev docker exec db psql -U polar -d polar_dev_<N> -c "SELECT 1"
dev docker exec redis redis-cli -n <N> dbsize
```

`exec`/`shell` auto-route by service name: app services hit this instance's
`polar-app-<N>` project, infra services hit `polar-shared`.

## Useful in-container commands

**api / worker (Python):**
```bash
uv run alembic upgrade head                             # run migrations
uv run alembic revision --autogenerate -m "message"     # create a migration
uv run alembic current                                  # show current revision
```
(Backend tests are the exception — they don't run in this container; see below.)

**web (Node):**
```bash
pnpm test
pnpm lint
```

**db (PostgreSQL):** the database is per-instance, so pass `polar_dev_<N>`, not
`polar`:
```bash
psql -U polar -d polar_dev_<N>
```

## Common workflows

**Daily development:**
```bash
dev docker up -d --wait     # start and wait until serving
dev docker ps               # confirm status
dev docker logs -f api      # watch as you work
dev docker down             # stop when done (data persists)
```

**After a git pull:** hot-reload handles most changes. If deps changed:
```bash
dev docker restart api worker web        # picks up new deps via startup uv sync / pnpm
# only if a Dockerfile or system dep changed:
dev docker up -b -d api worker web
```

**Run tests:**

Frontend unit tests run in the web container:
```bash
dev docker exec web pnpm test
```

Backend tests do **not** run in the `dev docker` api container. The suite's
session-wide `empty_test_bucket` fixture hard-requires S3 at
`http://127.0.0.1:9000` with `testing`-prefixed buckets, but the container
reaches the shared MinIO at `minio:9000` (per-instance `polar-s3-<N>` buckets,
no host port), so every test errors at setup. Run backend tests on the host
with the standard setup in `server/AGENTS.md` (`uv run task test`).

**Database operations:**
```bash
dev docker exec api uv run alembic upgrade head
dev docker exec api uv run alembic downgrade -1
dev docker exec db psql -U polar -d polar_dev_<N>
```

Find `<N>` (and the real ports) for the current worktree with `dev docker ports`.
