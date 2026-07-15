# Local Environment Management

Manage the Polar local development environment using Docker.

## Instructions

When the user invokes this command, help them manage their local development environment based on their request.

**Instance auto-detection:** The `dev docker` command automatically detects the correct instance from `CONDUCTOR_PORT` or the workspace path. No manual `-i` flag is needed.

### Quick Actions

| User Intent | Command |
|-------------|---------|
| Start environment | `dev docker up -d` |
| Stop environment | `dev docker down` |
| View logs | `dev docker logs` |
| Check status | `dev docker ps` |
| Restart | `dev docker restart` |
| Fresh start | `dev docker cleanup -f && dev docker up -d` |

### Environment Check

```bash
dev docker ps
```

### Viewing Logs

```bash
# All services
dev docker logs

# Specific service
dev docker logs api
dev docker logs worker
dev docker logs web
```

### Troubleshooting

1. **Check logs:**
   ```bash
   dev docker logs api
   ```

2. **Check Docker:**
   ```bash
   docker info
   ```

3. **Try restart:**
   ```bash
   dev docker restart
   ```

4. **Nuclear option (loses data):**
   ```bash
   dev docker cleanup -f
   dev docker up -d
   ```

### Service URLs

Run `dev docker ports` to see resolved ports for the current worktree.
Host-port formula: `Base + Instance` (8100 for API, 3100 for Web).

| Service  | Instance 0            | Instance 1            | Instance 2            |
| -------- | --------------------- | --------------------- | --------------------- |
| Web      | http://localhost:3000 | http://localhost:3101 | http://localhost:3102 |
| API      | http://localhost:8000 | http://localhost:8101 | http://localhost:8102 |
| API Docs | http://localhost:8000/docs | http://localhost:8101/docs | http://localhost:8102/docs |

### Shell Access

```bash
dev docker shell api      # Python environment
dev docker shell web      # Node environment
dev docker shell db       # PostgreSQL
```

## Common Workflows

### Start Fresh Development Session
```bash
dev docker up -d
dev docker logs api
```

### After Git Pull
```bash
dev docker restart api worker
```

### Run Backend Tests
```bash
dev docker shell api
uv run task test
```

### Run Frontend Tests
```bash
dev docker shell web
pnpm test
```

### Database Operations
```bash
dev docker shell api
uv run alembic upgrade head     # Run migrations
uv run alembic downgrade -1     # Rollback
```

## Help

```bash
dev docker --help
```
