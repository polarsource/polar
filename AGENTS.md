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

The customer portal authenticates with a session token rather than the dashboard login, so
`dev snap` can't reach it on its own. Get its URLs from `dev portal-urls --snap` first.

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

## Cursor Cloud specific instructions

The Cloud VM is set up to run the app **natively** (the `## Setup` path above:
`docker compose` for infra only + `uv run task api`/`worker` + `pnpm dev`), **not** the
`dev docker` full-stack CLI from the `local-environment` skill (that builds api/worker/web
images and is heavier). Standard lint/test/build/run commands are already documented in
`server/AGENTS.md` and `clients/AGENTS.md` — use those. Notes below are the non-obvious bits.

**Docker is not managed by systemd here.** On a fresh VM the daemon must be started
manually once before using any container/infra: `sudo dockerd > /tmp/dockerd.log 2>&1 &`.
The `ubuntu` user is in the `docker` group, so `docker`/`docker compose` work without `sudo`
once the daemon is up. `/etc/docker/daemon.json` is pinned to `fuse-overlayfs` with
`features.containerd-snapshotter: false` — required for Docker 29 in this VM; don't remove it.

**Infra + migrations.** Start Postgres/Redis/Minio with `cd server && docker compose up -d`
(this compose file only starts infra; `prometheus`/`grafana`/`tinybird`/`localstack` are behind
profiles). Then apply migrations with `uv run task db_migrate`. `uv` lives at `~/.local/bin/uv`
(on PATH via `~/.bashrc`).

**Backend won't even import its config without two build/gen artifacts** (both persist in the
snapshot; regenerate only if missing): the email renderer binary `server/emails/bin/react-email-pkg`
via `uv run task emails`, and `server/.jwks.json` + `server/.env` via `./dev/setup-environment`
(also `uv run task generate_dev_jwks`). Missing → pydantic `EMAIL_RENDERER_BINARY_PATH` / `JWKS` errors.

**Tests need no manual DB setup** — the `polar_test` database is auto-created/dropped by a
`sqlalchemy_utils` fixture. Run `uv run task test` or a subset with
`POLAR_ENV=testing uv run python -m pytest <path>`.

**Login has no external dependency.** Email OTP login codes are printed in the API log; when the
API runs natively grab it with `grep -a "LOGIN CODE" /tmp/polar-api.log | tail -1`. `admin@polar.sh`
is the conventional test account.

**Expected-but-harmless in local dev:** dashboard Analytics/Overview widgets show
"A network error occurred" because the Tinybird/ClickHouse analytics service isn't running
(optional, `tinybird` compose profile). The worker logs `prometheus_remote_write` connection
errors (optional `monitoring` profile). Stripe keys in `server/.env` are placeholders — checkout/
payment flows need a real Stripe sandbox (`dev stripe`, see the `local-environment` skill's
`payment-testing` rule).

**Onboarding gotcha:** the org-creation wizard's "Launch Dashboard" button only submits once the
Product step's required fields are filled (description ≥30 chars, ≥1 selling category, ≥1 pricing
model). The AUP AI check auto-APPROVEs when `PYDANTIC_AI_GATEWAY_API_KEY` is unset.
