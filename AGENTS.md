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
│   ├── adapters/               # Published framework and authentication adapters
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
│   ├── terraform/              # Terraform provider (Go) — see sdk/terraform/AGENTS.md;
│   │                           #   published via sync to polarsource/terraform-provider-polar (ADR-0010)
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
../dev/setup-environment      # generates server/.env — must run BEFORE docker compose
docker compose up -d          # PostgreSQL, Redis, Minio
uv sync                       # install deps
uv run task api               # API server
uv run task worker            # background worker (separate terminal)
```

`docker-compose.yml` interpolates the Postgres credentials and MinIO bucket names from
`server/.env`. Without that file they expand to empty strings and the `db` and `minio-setup`
containers exit 1 — **while `docker compose up -d` still exits 0**. Verify with `docker ps -a`,
not the exit code. (`dev up` gets this order right; only the manual sequence above used to not.)

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
tests in a new worktree, from the repo root:
```bash
./dev/setup-environment       # generates server/.env, server/.jwks.json, clients/apps/web/.env.local
uv run --directory server task emails   # builds server/emails/bin/react-email-pkg
```
Without these, pytest fails at config load with `JWKS` and `EMAIL_RENDERER_BINARY_PATH` errors.

Only two artifacts actually block config import: `server/.jwks.json` and *any existing file* at
`EMAIL_RENDERER_BINARY_PATH` — the validator only checks that the path exists. When you need to
collect tests, lint or typecheck without waiting on the ~60s email build, do what
`test_sdk.yaml` does: `touch /tmp/email-renderer` and set
`POLAR_EMAIL_RENDERER_BINARY_PATH=/tmp/email-renderer`. Tests that render an email will fail,
nothing else will.

## Development Workflow

**Always prefix Python commands with `uv run`** — it guarantees the correct Python (3.14),
project dependencies, environment variables, and virtualenv context.

```bash
cd server
uv run task test_fast                                     # backend tests, parallel, no coverage
uv run task lint && uv run task lint_types                # lint + type-check
uv run alembic revision --autogenerate -m "description"   # generate a migration from model changes
uv run alembic upgrade head                               # apply migrations
```

`uv run task test` adds coverage and runs serially. Use `task test_fast` (`-n auto`, no coverage)
interactively, or scope to a path: `POLAR_ENV=testing uv run python -m pytest tests/<module>`.

Set `POLAR_TEST_DATABASE_TEMPLATE=polar_test` (with `polar_test` created and migrated) and each
xdist worker clones that database instead of replaying the whole migration history into its own
— see `tests/fixtures/database.py`. CI does this in `test_server.yaml`. **If you add a migration,
re-run `POLAR_ENV=testing uv run task db_migrate` to refresh the template**, or workers will
clone a stale schema.

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

## Claude Code on the web

`.claude/hooks/session-start.sh` runs as a `SessionStart` hook and leaves the container ready to
run tests and linters. It mirrors `.github/workflows/test_server.yaml` rather than `dev up`,
because `dev up` targets interactive local development: it aborts if the Tinybird CLI install
fails, curl-installs nvm, calls `systemctl start docker`, prompts for GitHub/Stripe, and — worst
for an agent — swallows a failed email-renderer build, the artifact that blocks config import.

It is idempotent, skips work already done, and reports failed steps in its output rather than
aborting. It fires on session start and resume, not on every compaction. Read the script for
what it does; its log is `polar-session-start.log` in `$TMPDIR` (`/tmp` unless overridden).

Deliberately excluded, none of it needed for tests or linters: `dev seed`, `dev start`/tmux,
Stripe keys or CLI, GitHub App setup, the Tinybird CLI, `dev docker`, and the web build. Redis is
replaced by `FakeAsyncRedis` in tests, Stripe objects are fakes, and Tinybird tests self-skip.
`fonts-noto-cjk` is also left out — install it only if a PDF or invoice test fails on glyphs.

Two things to know when running tests here:

- An unscoped `pnpm test` runs 19 turbo tasks at concurrency 10 on 4 CPUs and produces spurious
  `Test timed out in 5000ms` failures in `packages/checkout` and `apps/web` that pass in
  isolation. Scope with `--filter`, or pass `--concurrency=2`.
- `packages/cli` tests need `bun`.

## Cursor Cloud specific instructions

Prefer the Polar Development CLI (`dev/cli/`, alias `dev`) — the same path local developers use.
See `dev/cli/README.md` for the full command list. Do **not** use `dev docker` (the heavier
image-based stack from the `local-environment` skill) unless you specifically need it.
Standard lint/test commands live in `server/AGENTS.md` and `clients/AGENTS.md`.

**Day-to-day start sequence**

```bash
# Once per VM boot (Docker isn't managed by systemd here):
sudo dockerd > /tmp/dockerd.log 2>&1 &

dev up --skip-integrations   # deps, infra (incl. Tinybird), migrations, builds
dev seed                     # sample orgs/products + admin@polar.sh (NOT part of `dev up`)
dev start                    # api + worker + web (+ stripe) in tmux session `polar`
# Stop with:  dev stop
# Status:     dev status
```

`--skip-integrations` avoids interactive GitHub/Stripe prompts. `dev up` does **not** load
sample data; run `dev seed` afterward. That creates
`admin@polar.sh` with access to seeded orgs (notably `admin-org` with a `Pro` product, plus
`acme-corp`, `polar`, etc.). Login OTP codes print in the API pane. If seed says "Already
seeded" (exit 2), the DB already has `acme-corp` — use `dev seed --reset` only when you
intentionally want a wipe.

`dev start` ends by *attaching* to the `polar` tmux session; in a non-interactive agent shell,
create/attach then immediately `tmux detach-client -s polar`, or run `dev api` / `dev worker` /
`dev web` as individual detached processes. The stripe pane of `dev start` will prompt to
install the Stripe CLI via Homebrew — decline on Linux (no Homebrew); checkout/payment testing
needs a real Stripe sandbox later (`dev stripe`, see the `local-environment` skill's
`payment-testing` rule).

**One-time shell wiring** (specific to the Cursor Cloud VM snapshot — verify before relying on
any of it, none of it holds in other cloud containers): `./dev/cli/install` adds the `dev`
alias; Node 24 is installed via nvm; `uv` is at `~/.local/bin/uv`. Source `~/.bashrc` (or start
a login shell) so `nvm use 24` and the `dev` alias are active. Where the alias is absent, call
`./dev/cli/dev` directly. `clients/` pins Node 24 via `.nvmrc`/`.node-version`, but pnpm's
`engine-strict` is off and the repo ships no `.npmrc`, so those pins are warnings — install,
lint, typecheck, test and `next build` all pass on Node 22.

**Docker caveats** (again Cursor Cloud VM specific). `/etc/docker/daemon.json` is pinned to
`fuse-overlayfs` with `features.containerd-snapshotter: false` — required for Docker 29 in that
VM; don't remove it. The `ubuntu` user is in the `docker` group. Elsewhere the file may not
exist and the daemon may run as root on `overlayfs`; check `docker info` rather than assuming.

**Backend config artifacts.** Config import fails without the email renderer binary
(`server/emails/bin/react-email-pkg`, built by `dev up` / `uv run task emails`) and
`server/.jwks.json` (from `./dev/setup-environment` / `dev up`). Missing → pydantic
`EMAIL_RENDERER_BINARY_PATH` / `JWKS` errors. `server/.env` is **not** among them for tests:
under `POLAR_ENV=testing` (which `tests/conftest.py` forces) `polar/config.py` loads the
committed `server/.env.testing`. `server/.env` is still required before `docker compose up -d`,
which interpolates it. `dev status` reports "Worker unknown (check manually)" by design —
confirm with `pgrep -af dramatiq` or the `polar` tmux pane.

**Tests need no manual DB setup** — an autouse `sqlalchemy_utils` fixture creates and drops
`polar_test_<worker_id>` (`polar_test_master` without xdist), not `polar_test` itself. Run
`uv run task test_fast` or a subset with `POLAR_ENV=testing uv run python -m pytest <path>`.
`dev/create-test-db` creates a plain, unmigrated `polar_test` and is not part of this path.

**Login.** Email OTP codes are printed in the API pane / log (`LOGIN CODE: …`). Grab with
`tmux capture-pane -t polar:services.0 -p | grep -a "LOGIN CODE" | tail -1`. `admin@polar.sh`
is the conventional test account.

**Onboarding gotcha.** The org-creation wizard's "Launch Dashboard" button only submits once the
Product step's required fields are filled (description ≥30 chars, ≥1 selling category, ≥1 pricing
model). The AUP AI check auto-APPROVEs when `PYDANTIC_AI_GATEWAY_API_KEY` is unset.
