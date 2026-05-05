# The Polar Development CLI

A CLI tool to streamline Polar development environment setup and management.

## Installation

Run the install script to add the `dev` alias to your shell:

```bash
./dev/cli/install
source ~/.zshrc  # or restart your terminal
```

Now you can use `dev` from anywhere in the repo.

## Commands

### Environment Setup

```bash
dev up                  # Full setup: install deps, start infra, run migrations
dev up --clean          # Clean setup (re-runs all steps)
dev down                # Stop all infrastructure
dev down --volumes      # Stop and remove all data
dev reset               # Reset everything to test dev up from scratch
dev reset --force       # Reset without confirmation
```

### Running Services

```bash
dev api                 # Start backend API (port 8000)
dev api --port 8080     # Start on custom port
dev web                 # Start frontend (port 3000)
dev web --port 3001     # Start on custom port
dev worker              # Start background job worker
```

### Database

```bash
dev db migrate          # Run database migrations
dev db reset            # Reset database to clean state
dev db reset --force    # Reset without confirmation
```

### Diagnostics

```bash
dev status              # Show environment status
dev doctor              # Check prerequisites and configuration
dev seed                # Load sample data
dev seed --reset        # Recreate database and load fresh seed data
dev help                # Show all commands
```

### Deploy lock

```bash
dev lock-deploys "<reason>"   # Block all merges to main (announces in Slack)
dev unlock-deploys            # Lift the block (announces in Slack)
```

Uses your `gh` CLI auth to trigger the `deploy-lock.yml` / `deploy-unlock.yml`
workflows, which toggle a GitHub ruleset. The `/emergency` PR command still
works because its identity is on the ruleset's bypass list.


## Docker dev environment

Two-tier model behind one CLI:

- **Shared infra** (one per machine): postgres, redis, minio, tinybird, plus optional prometheus/grafana. No host ports exposed by default — apps reach infra over the `polar-shared` Docker network.
- **App stack** (one per worktree/instance): api, worker, web. Each instance gets its own postgres DB (`polar_dev_<N>`), Redis DB index, and S3 bucket pair on the shared infra, so multiple instances coexist safely.

Service-aware commands (`logs`, `exec`, `shell`, `restart`) auto-route by service name — no need to know which project a service lives in.

```bash
# Per worktree (instance auto-detected from CONDUCTOR_PORT or workspace path)
dev docker up                           # start shared infra (if needed) + this instance's app stack
dev docker up --monitoring              # also start prometheus + grafana on the shared stack
dev docker -i 2 up                      # explicit instance number
dev docker logs api                     # follow this instance's api logs
dev docker logs db                      # follow shared postgres logs (auto-routed)
dev docker shell api                    # shell into the api container
dev docker exec db psql -U polar -l     # reach shared postgres without host ports
dev docker exec redis redis-cli -n 1 dbsize
dev docker ps                           # show both shared + this instance's containers
dev docker down                         # stop this instance's app stack (shared infra stays up)
dev docker cleanup                      # remove this instance's app containers + caches

# Wipe everything (destroys data for ALL instances on this machine)
dev docker down --all                   # also stop shared infra
dev docker cleanup --all                # also DELETE shared volumes (postgres data, MinIO, tinybird)

# Advanced: publish shared infra ports on the host (TablePlus, host-side psql, etc.)
# `--expose` only takes effect on the first start of shared infra; tweak the host
# port via env vars (POLAR_SHARED_DB_HOST_PORT, POLAR_SHARED_REDIS_HOST_PORT, etc.).
dev docker down --all && dev docker up --expose
```

## Adding New Steps

The `dev up` command runs steps from `up_steps/` in alphabetical order. Each step file needs:

```python
from shared import Context, console, step_status

NAME = "Human readable name"

def run(ctx: Context) -> bool:
    """Execute the step. Return True on success."""
    # ctx.clean - if --clean flag was passed
    # ctx.skip_integrations - if --skip-integrations was passed
    step_status(True, "Did something", "details")
    return True
```

Files are named with number prefixes to control order: `01_check_prerequisites.py`, `02_setup_node.py`, etc.

## Adding New Commands

Commands in `commands/` are auto-registered. Each command file needs:

```python
import typer
from shared import console

def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def mycommand() -> None:
        """Command description."""
        console.print("Hello!")
```

The `prompt_setup` callback checks if the environment is ready and offers to run `dev up` if not.
