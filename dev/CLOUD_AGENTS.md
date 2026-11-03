# Cloud agent environments

Setup notes for agents running in Claude Code on the web and Cursor Cloud VMs. Local development
doesn't need any of this; see the root `AGENTS.md`.

## Claude Code on the web

`.claude/hooks/session-start.sh` runs as a `SessionStart` hook and leaves the container ready to
run tests and linters. It mirrors `.github/workflows/test_server.yaml` rather than `dev up`,
because `dev up` targets interactive local development: it aborts if the Tinybird CLI install
fails, curl-installs nvm, calls `systemctl start docker`, prompts for GitHub/Stripe, and — worst
for an agent — swallows a failed email-renderer build, the artifact that blocks config import.

It is idempotent, skips work already done, and reports failed steps in its output rather than
aborting. It fires on session start and resume, not on every compaction. Read the script for
what it does; its log is `polar-session-start.log` in `$TMPDIR` (`/tmp` unless overridden), and
the Docker daemon's is `polar-dockerd.log` next to it.

The image's pnpm switches to the `packageManager` version without running its postinstall,
which leaves a shim turbo can't exec ("Exec format error" on a cache miss). The hook installs
that version's native binary under `~/.local/share/polar-pnpm/` and links it into
`~/.local/bin`, ahead of the image's pnpm on `PATH`.

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
`./dev/cli/dev` directly. The root `.nvmrc` pins Node 24 for the whole repo.

**Docker caveats** (again Cursor Cloud VM specific). `/etc/docker/daemon.json` is pinned to
`fuse-overlayfs` with `features.containerd-snapshotter: false` — required for Docker 29 in that
VM; don't remove it. The `ubuntu` user is in the `docker` group. Elsewhere the file may not
exist and the daemon may run as root on `overlayfs`; check `docker info` rather than assuming.

**Backend config artifacts.** Config import fails without the email renderer binary
(`server/emails/bin/react-email-pkg`, built by `dev up` / `uv run task emails`) → pydantic
`EMAIL_RENDERER_BINARY_PATH` error. `server/.env` is **not** among them for tests:
under `POLAR_ENV=testing` (which `tests/conftest.py` forces) `polar/config.py` loads the
committed `server/.env.testing`. `server/.env` is still required before `docker compose up -d`,
which interpolates it. `dev status` reports "Worker unknown (check manually)" by design —
confirm with `pgrep -af dramatiq` or the `polar` tmux pane.

**Tests need no manual DB setup** — an autouse `sqlalchemy_utils` fixture creates and drops
`polar_test_<worker_id>` (`polar_test_master` without xdist), not `polar_test` itself. Run
`uv run task test_fast` or a subset with `POLAR_ENV=testing uv run python -m pytest <path>`.
`dev/create-test-db` creates a plain, unmigrated `polar_test` and is not part of this path.
