# Polar - Development Makefile
# Uses podman-compose for container management

SHELL := /bin/bash
COMPOSE := podman-compose
COMPOSE_FILE := server/docker-compose.yml

.PHONY: help setup run stop \
        infra-up infra-down infra-logs infra-ps \
        api worker \
        frontend \
        install install-backend install-frontend emails-build backoffice-build \
        test test-fast test-frontend \
        lint lint-types lint-frontend \
        db-migrate db-migrate-create db-reset \
        seeds \
        generate \
        monitoring-up monitoring-down \
        logs-api logs-db logs-redis logs-minio

# ─────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' | \
		sort

# ─────────────────────────────────────────────
# First-time setup
# ─────────────────────────────────────────────

setup: ## Generate .env files and install all dependencies
	./dev/setup-environment
	$(MAKE) install

install: install-backend install-frontend emails-build backoffice-build ## Install all dependencies

install-backend: ## Install Python dependencies
	cd server && uv sync

install-frontend: ## Install Node dependencies
	cd clients && pnpm install

emails-build: ## Build the email renderer binary (required for worker)
	cd server && uv run task emails

backoffice-build: ## Build backoffice CSS/JS static assets (Tailwind + DaisyUI + HTMX)
	cd server/polar/backoffice && pnpm install && pnpm build

# ─────────────────────────────────────────────
# Run everything (main dev command)
# ─────────────────────────────────────────────

run: infra-up ## Start infra + API + worker + frontend (full dev stack)
	@echo "Starting full dev stack..."
	@$(MAKE) -j3 api worker frontend

# ─────────────────────────────────────────────
# Infrastructure (Postgres, Redis, MinIO)
# ─────────────────────────────────────────────

infra-up: ## Start infrastructure services (db, redis, minio)
	$(COMPOSE) -f $(COMPOSE_FILE) up -d db redis minio minio-setup

infra-down: ## Stop all infrastructure services
	$(COMPOSE) -f $(COMPOSE_FILE) down

infra-ps: ## Show running container status
	$(COMPOSE) -f $(COMPOSE_FILE) ps

infra-logs: ## Tail logs from all infra services
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f db redis minio

# ─────────────────────────────────────────────
# Backend processes
# ─────────────────────────────────────────────

api: ## Start the FastAPI server (http://127.0.0.1:8000)
	cd server && uv run task api

worker: ## Start the Dramatiq background worker
	cd server && uv run task worker

# ─────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────

frontend: ## Start the Next.js dev server (http://127.0.0.1:3000)
	cd clients && pnpm dev-web

generate: ## Regenerate API client from OpenAPI spec
	cd clients && pnpm generate

# ─────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────

test: ## Run backend tests with coverage
	cd server && uv run task test

test-fast: ## Run backend tests in parallel (no coverage)
	cd server && uv run task test_fast

test-frontend: ## Run frontend tests
	cd clients && pnpm test

# ─────────────────────────────────────────────
# Linting & type checking
# ─────────────────────────────────────────────

lint: ## Auto-fix backend linting (ruff)
	cd server && uv run task lint

lint-types: ## Type check backend (mypy)
	cd server && uv run task lint_types

lint-frontend: ## Lint frontend (ESLint + Prettier)
	cd clients && pnpm lint

typecheck: ## Type check frontend (TypeScript)
	cd clients && pnpm typecheck

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────

db-migrate: ## Apply pending database migrations
	cd server && uv run alembic upgrade head

db-migrate-create: ## Create a new migration (usage: make db-migrate-create MSG="description")
	cd server && uv run alembic revision --autogenerate -m "$(MSG)"

db-reset: ## Drop and recreate the database (WARNING: destroys all data)
	cd server && uv run task db_recreate

seeds: ## Load seed/sample data into the database
	cd server && uv run task seeds_load

enable-payments: ## Enable payments for a local org (usage: make enable-payments ORG=slug)
	cd server && uv run task enable_payments $(ORG)

# ─────────────────────────────────────────────
# Monitoring (optional)
# ─────────────────────────────────────────────

monitoring-up: ## Start Prometheus + Grafana (http://127.0.0.1:3001, polar/polar)
	$(COMPOSE) -f $(COMPOSE_FILE) --profile monitoring up -d

monitoring-down: ## Stop monitoring stack
	$(COMPOSE) -f $(COMPOSE_FILE) --profile monitoring down

# ─────────────────────────────────────────────
# Individual service logs
# ─────────────────────────────────────────────

logs-db: ## Tail PostgreSQL logs
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f db

logs-redis: ## Tail Redis logs
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f redis

logs-minio: ## Tail MinIO logs
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f minio
