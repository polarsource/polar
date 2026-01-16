# Local Environment Management

Manage the Polar local development environment using Docker.

## Instructions

When the user invokes this command, help them manage their local development environment based on their request.

### Step 1: Detect Instance (REQUIRED)

**ALWAYS check `CONDUCTOR_PORT` first to determine the correct instance:**

```bash
echo $CONDUCTOR_PORT
```

- If `CONDUCTOR_PORT` is **not set**: Not running in Conductor, use instance 0 (default)
- If `CONDUCTOR_PORT` is set: Calculate instance from the port

**Instance calculation:**
```bash
INSTANCE=$((CONDUCTOR_PORT - 55090))
```

| CONDUCTOR_PORT | Instance | API Port | Web Port |
|----------------|----------|----------|----------|
| 55090 | 0 | 8000 | 3000 |
| 55091 | 1 | 8100 | 3100 |
| 55092 | 2 | 8200 | 3200 |
| 55093 | 3 | 8300 | 3300 |

**All subsequent commands must include `-i $INSTANCE`** to use the correct isolated environment.

### Step 2: Quick Actions

Replace `$INSTANCE` with the calculated value from Step 1:

| User Intent | Command |
|-------------|---------|
| Start environment | `./dev/docker-dev -i $INSTANCE -d` |
| Stop environment | `./dev/docker-dev -i $INSTANCE down` |
| View logs | `./dev/docker-dev -i $INSTANCE logs -f` |
| Check status | `./dev/docker-dev -i $INSTANCE ps` |
| Restart | `./dev/docker-dev -i $INSTANCE restart` |
| Fresh start | `./dev/docker-dev -i $INSTANCE cleanup && ./dev/docker-dev -i $INSTANCE -d` |

### Environment Check

```bash
./dev/docker-dev -i $INSTANCE ps
```

### Viewing Logs

```bash
# All services
./dev/docker-dev -i $INSTANCE logs -f

# Specific service
./dev/docker-dev -i $INSTANCE logs -f api
./dev/docker-dev -i $INSTANCE logs -f worker
./dev/docker-dev -i $INSTANCE logs -f web
```

### Troubleshooting

1. **Check logs:**
   ```bash
   ./dev/docker-dev -i $INSTANCE logs api
   ```

2. **Check Docker:**
   ```bash
   docker info
   ```

3. **Try restart:**
   ```bash
   ./dev/docker-dev -i $INSTANCE restart
   ```

4. **Nuclear option (loses data):**
   ```bash
   ./dev/docker-dev -i $INSTANCE cleanup
   ./dev/docker-dev -i $INSTANCE -d
   ```

### Service URLs

Port = Base Port + (Instance × 100)

| Service | Instance 0 | Instance 1 | Instance 2 |
|---------|------------|------------|------------|
| Web | http://localhost:3000 | http://localhost:3100 | http://localhost:3200 |
| API | http://localhost:8000 | http://localhost:8100 | http://localhost:8200 |
| API Docs | http://localhost:8000/docs | http://localhost:8100/docs | http://localhost:8200/docs |
| MinIO Console | http://localhost:9001 | http://localhost:9101 | http://localhost:9201 |

### Shell Access

```bash
./dev/docker-dev -i $INSTANCE shell api      # Python environment
./dev/docker-dev -i $INSTANCE shell web      # Node environment
./dev/docker-dev -i $INSTANCE shell db       # PostgreSQL
```

## Common Workflows

### Start Fresh Development Session
```bash
./dev/docker-dev -i $INSTANCE -d
./dev/docker-dev -i $INSTANCE logs -f api
```

### After Git Pull
```bash
./dev/docker-dev -i $INSTANCE restart api worker
```

### Run Backend Tests
```bash
./dev/docker-dev -i $INSTANCE shell api
uv run task test
```

### Run Frontend Tests
```bash
./dev/docker-dev -i $INSTANCE shell web
pnpm test
```

### Database Operations
```bash
./dev/docker-dev -i $INSTANCE shell api
uv run alembic upgrade head     # Run migrations
uv run alembic downgrade -1     # Rollback
```

## Help

```bash
./dev/docker-dev -h
```
