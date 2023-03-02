# Server

## Getting started

```bash
# Run these commands in this directory (./server)
#
# Start PostgreSQL and Redis 
docker compose up -d

# Install dependencies, enter the poetry shell
poetry install
poetry shell

# Run database migrations
make db-migrate

# Fast API backend
uvicorn polar.app:app --reload --workers 1 --port 8000

# (in another terminal) Start the celery worker
celery -A run_worker:app worker

# Run the tests
pytest
```

## Create a database migration

```bash
alembic revision --autogenerate -m "[description]"
```