# Local Environment (agent entry point)

This directory is the `local-environment` skill: managing the Polar local dev
stack via the `dev docker` CLI.

Start with **[SKILL.md](SKILL.md)** — it holds the model (shared infra vs
per-instance app stack), instance auto-detection, the command quick-reference,
and the rules index. Don't duplicate that content here; keep this file a pointer
so there's a single source of truth.

For specific tasks, read the relevant rule:

- [start-environment](rules/start-environment.md) — starting the stack (`--wait`, `--pull`, `--no-detach`)
- [stop-environment](rules/stop-environment.md) — stopping and cleanup (app vs shared)
- [manage-instances](rules/manage-instances.md) — parallel worktree instances
- [service-architecture](rules/service-architecture.md) — services, ports, healthchecks
- [view-logs](rules/view-logs.md) — viewing service logs
- [shell-and-workflows](rules/shell-and-workflows.md) — shell access and common workflows
- [troubleshooting](rules/troubleshooting.md) — common errors and fixes
- [payment-testing](rules/payment-testing.md) — login codes, Stripe webhooks, backoffice
