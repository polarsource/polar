# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Polar is an open source payment infrastructure platform for developers. It's a monorepo consisting of:
- **Backend**: Python/FastAPI API server with PostgreSQL, Redis, and S3 storage
- **Frontend**: Next.js web application with TypeScript
- **Workers**: Dramatiq background job processors

## Commands

### Backend Development

```bash
cd server

# Install dependencies (requires uv)
uv sync

# Build email templates (required for first run)
uv run task emails

# Apply database migrations
uv run task db_migrate

# Start API server (http://127.0.0.1:8000)
uv run task api

# Start background worker
uv run task worker

# Run tests
uv run task test          # with coverage
uv run task test_fast     # faster, parallel execution

# Linting and formatting
uv run task lint          # auto-fix
uv run task lint_check    # check only
uv run task lint_types    # type checking with mypy

# Database utilities
uv run task db_recreate   # drop and recreate database
uv run task seeds_load    # load sample data

# Generate Alembic migration
uv run alembic revision --autogenerate -m "<description>"
```

### Frontend Development

```bash
cd clients

# Install dependencies (requires pnpm)
pnpm install

# Start development server (http://127.0.0.1:3000)
pnpm dev

# Build production bundle
pnpm build

# Run linting
pnpm lint

# Run tests
pnpm test

# Generate API client from OpenAPI spec
pnpm generate

# Type checking
cd apps/web && pnpm typecheck
```

### Docker Services (Backend)

```bash
cd server
docker compose up -d  # Start PostgreSQL, Redis, Minio
```

## Architecture

### Backend Structure
- **`server/polar/`**: Core application code organized into modules
  - Each module typically contains:
    - `endpoints.py`: FastAPI route handlers
    - `service.py`: Business logic layer
    - `repository.py`: Database access layer (SQLAlchemy)
    - `schemas.py`: Pydantic models for API validation
    - `auth.py`: Module-specific authentication
    - `tasks.py`: Dramatiq background tasks
  - **`models/`**: Global SQLAlchemy models (exception to modular structure)
  - **`migrations/`**: Alembic database migrations

### Frontend Structure
- **`clients/apps/web/`**: Main Next.js dashboard application
  - `src/app/(main)/dashboard/`: User dashboard pages
  - `src/app/(main)/[organization]/`: Organization pages
- **`clients/packages/`**: Shared packages
  - `ui/`: React components (Radix UI + Tailwind)
  - `client/`: Generated TypeScript API client
  - `sdk/`: Published SDK package

### Authentication System
- Uses `AuthSubject[T]` type where T can be: User, Organization, Customer, or Anonymous
- Module-specific authenticators defined in `auth.py` files
- Scopes control access to operations (e.g., `web_default`, `discounts_write`)
- Web-specific dependencies: `WebUser`, `WebUserOrAnonymous`, `AdminUser`

## Key Integrations
- **Stripe**: Payment processing (requires API keys in `server/.env`)
- **GitHub**: Authentication and repository features (requires GitHub App setup)
- **S3/Minio**: File storage
- **Redis**: Cache and job queue
- **PostgreSQL**: Primary database

## Development Guidelines

### Backend
- Follow modular structure with service/repository pattern
- Use SQLAlchemy ORM consistently
- Proper async/await patterns with AsyncSession
- Repository methods should accept domain objects over IDs when available
- Include HTTP status codes in custom exceptions
- Use dependency injection for database sessions

### Frontend
- Use TanStack Query for data fetching
- State management with Zustand
- UI components from shared `@polar-sh/ui` package
- Follow Next.js App Router conventions
- Tailwind CSS for styling

### Testing
- Backend: pytest with class-based test organization
- Frontend: Jest with React Testing Library
- Use existing fixtures and avoid redundant setup
- Mock external services appropriately

## Environment Setup

Run `./dev/setup-environment` to generate `.env` files. For GitHub integration:
```bash
./dev/setup-environment --setup-github-app --backend-external-url https://yourdomain.ngrok.dev
```

For Stripe integration, manually add to `server/.env`:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`