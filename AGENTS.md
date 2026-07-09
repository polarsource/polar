# Polar

Open source payment infrastructure platform for developers. Monorepo with a Python/FastAPI
backend and a Next.js frontend.

This file is the entry point for AI agents working in this repo: start here, then read the
per-area `AGENTS.md` linked from the Architecture and Conventions sections before writing code.

## General Guidelines

- Do not add comments unless necessary — the code should be self-explanatory.
- Use meaningful variable and function names.
- Follow established conventions and good practices (SOLID, maintainable code).
- Do not modify code unrelated to the task or issue you are working on.

## Architecture

```
polar/
├── server/                 # Python/FastAPI backend — see server/AGENTS.md
│   ├── polar/
│   │   ├── {module}/
│   │   │   ├── endpoints.py     # FastAPI routes
│   │   │   ├── service.py       # Business logic (singleton)
│   │   │   ├── repository.py    # Database queries (SQLAlchemy)
│   │   │   ├── schemas.py       # Pydantic models
│   │   │   └── tasks.py         # Dramatiq background jobs
│   │   ├── models/             # SQLAlchemy models (global, not per-module)
│   │   └── backoffice/         # Admin UI (HTMX + DaisyUI) — see server/polar/backoffice/AGENTS.md
│   └── migrations/             # Alembic database migrations
├── clients/                # Turborepo + pnpm frontend — see clients/AGENTS.md
│   ├── apps/web/               # Next.js dashboard
│   ├── apps/app/               # Expo / React Native (iOS + Android)
│   ├── apps/orbit/             # Orbit design-system showcase
│   ├── packages/orbit/         # Orbit design system (components + tokens)
│   ├── packages/ui/            # Legacy shared components (Radix + Tailwind)
│   ├── packages/client/        # Generated API client + data hooks
│   └── packages/i18n/          # Translations
├── dev/                    # Dev scripts and tooling
├── docs/                   # User/developer docs (Mintlify)
├── sdk/                    # SDKs and generators
│   ├── generator/              # Internal SDK code generator
│   ├── python/                 # Generated Python SDK
│   └── overlays/               # OpenAPI Overlay tweaks for Speakeasy-generated SDKs
└── .claude/                # Claude Code config (settings, hooks, commands)
```

The TypeScript API client is generated from the backend's OpenAPI schema. After changing the
API, run `pnpm run generate` in `clients/packages/client`.

## Setup

```bash
./dev/setup-environment     # generate .env files
# For GitHub integration:
./dev/setup-environment --setup-github-app --backend-external-url https://yourdomain.ngrok.dev
```

**Backend** (http://127.0.0.1:8000) — from `server/`:
```bash
docker compose up -d          # PostgreSQL, Redis, Minio
uv sync                       # install deps
uv run task api               # API server
uv run task worker            # background worker (separate terminal)
```

**Frontend** (http://127.0.0.1:3000) — from `clients/`:
```bash
pnpm install && pnpm dev
```

**Stripe** — add to `server/.env`:
- `POLAR_STRIPE_SECRET_KEY`
- `POLAR_STRIPE_PUBLISHABLE_KEY`
- `POLAR_STRIPE_WEBHOOK_SECRET`
- `POLAR_STRIPE_CONNECT_WEBHOOK_SECRET`

**Fresh worktrees** (`.claude/worktrees/`) don't carry `.env` or built artifacts. Before running
tests in a new worktree:
```bash
cd server
./dev/setup-environment       # generates .env
uv run task generate_dev_jwks # creates .jwks.json
uv run task emails            # builds emails/bin/react-email-pkg
```
Without these, pytest fails at config load with `JWKS` and `EMAIL_RENDERER_BINARY_PATH` errors.

## Development Workflow

**Always prefix Python commands with `uv run`** — it guarantees the correct Python (3.14),
project dependencies, environment variables, and virtualenv context.

```bash
cd server
uv run task test                                          # backend tests (pnpm test for frontend)
uv run task lint && uv run task lint_types                # lint + type-check
uv run alembic revision --autogenerate -m "description"   # generate a migration from model changes
uv run alembic upgrade head                               # apply migrations
```

**Visual regression testing** — use `dev snap` to capture before/after screenshots across branches:
```bash
dev snap --branch my-feature        # test a specific branch
dev snap --detect                   # auto-detect URLs from git diff
```

See `server/AGENTS.md` for backend command and testing specifics.

## Conventions

Detailed, review-enforced patterns live next to the code — read the relevant file before writing:

- **Backend** → `server/AGENTS.md`: modular structure, repository/service/endpoint patterns,
  `lazy="raise"` relationships, status-coded `PolarError`, endpoints return ORM models,
  authentication (`AuthSubject` + scopes).
- **Frontend** → `clients/AGENTS.md`: Orbit `<Box />` design system (raw Tailwind is **deprecated**
  for layout/spacing/color/etc.), TanStack Query for data, Zustand for state, 250-line `max-lines` limit.
- **Backoffice** → `server/polar/backoffice/AGENTS.md`: HTMX + DaisyUI patterns.

**i18n:** add new translatable strings only to `clients/packages/i18n/src/locales/en.ts` — a CI
job auto-translates the rest. Don't edit other locale files. (More in `clients/AGENTS.md`.)

## Architecture Decisions (ADRs)

Significant, cross-cutting, or hard-to-reverse decisions are recorded as short ADRs in
`handbook/engineering/decisions/` (see the [index](handbook/engineering/decisions/index.mdx)).
Treat **Accepted** ADRs as binding:

- Before changing a load-bearing pattern, check for a relevant ADR (grep that directory).
- If code contradicts an Accepted ADR, flag it and cite the id (e.g. "violates ADR-0002").
- If a change makes a significant decision no ADR covers, propose a new one from
  `handbook/engineering/decisions/template.mdx` rather than losing the rationale in the diff.

## Custom Commands

- `/polar-code-review` — checks the diff against Polar-specific rules with 2 parallel agents (conventions, ADR compliance). Bugs, security, and simplification are covered by the built-in `/code-review`, `/security-review`, and `/simplify`.

## Documentation

- **Handbook**: https://handbook.polar.sh/engineering/
- **Design docs**: https://handbook.polar.sh/engineering/design-documents/
- **API guidelines**: https://handbook.polar.sh/engineering/rest-api-guidelines
- **User/developer docs**: `docs/` (Mintlify) — `cd docs && pnpm dev` to serve locally.

## Key Integrations

- **Stripe**: payments and subscriptions. Needs API keys + webhook secret in `server/.env`.
- **GitHub**: authentication and repository features. Needs a GitHub App configured for local dev.
- **Slack**: workspace integration for notifications. Configured via OAuth at runtime (no `.env` setup).
- **S3 / Minio**: file storage.
- **Redis**: cache and job queue.
- **PostgreSQL**: primary database.
