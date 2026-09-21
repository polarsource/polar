# The Polar Development CLI

A CLI tool to streamline Polar development environment setup and management.

## Installation

Run the install script to add the `dev` alias to your shell:

```bash
./dev/cli/install
source ~/.zshrc  # or restart your terminal
```

Now you can use `dev` from anywhere in the repo.

## Privacy & Analytics

The CLI collects anonymous usage analytics to help improve the tool. This includes:

- Command name and flags used (secrets/tokens are automatically redacted)
- Operating system
- Git user name and email (for identification)

To disable analytics, set either environment variable:

- `DEV_CLI_NO_ANALYTICS=1` — Polar-specific opt-out
- `DO_NOT_TRACK=1` — Standard privacy flag

## Commands

### Environment Setup

```bash
dev up                  # Full setup: install deps, start infra, run migrations
dev up --void           # Also configure Void infrastructure and write .env.void
dev up --clean          # Clean setup (re-runs all steps)
dev down                # Stop all infrastructure
dev down --volumes      # Stop and remove all data
dev reset               # Reset everything to test dev up from scratch
dev reset --force       # Reset without confirmation
```

### Running Services

```bash
dev start               # Start all services (api, worker, web, stripe, void) in tmux
dev stop                # Stop all services (kills the tmux session)
dev api                 # Start backend API (port 8000)
dev api --port 8080     # Start on custom port
dev web                 # Start frontend (port 3000)
dev web --port 3001     # Start on custom port
dev worker              # Start background job worker
dev void                # Start Void infrastructure and its Temporal worker
dev switch my-branch    # Stop web, checkout branch, wipe .next, relaunch web
dev switch -b my-branch # ...creating the branch (git checkout -b)
dev switch -i my-branch # ...and reinstall JS deps (skips package prebuilds)
```

### Void development

Start Docker Desktop. From the repo root:

```bash
dev up --void
dev seed
dev start
```

`dev up --void` starts Tinybird and Temporal and writes `server/.env.void`. It
does not seed. `dev seed` creates `void-development` and `po-bot` on
`void@polar.sh`. Fill the demo dataset afterwards:

```bash
cd server && uv run task void_seed_demo
```

Sign in at http://127.0.0.1:3000 with `void@polar.sh`. Get the login code from
the API pane. Select `void-development`, which has Void enabled and, after the
demo seed, four configuration versions (v3 active, v4 a promoted draft), twelve
customers with agent and service identities, subscriptions on three plans, thirty
days of usage events and three pricing scenarios. `dev void` must be running for
the usage to reach Tinybird and the meters. Rebuild the dataset from scratch with:

```bash
cd server && uv run task void_seed_demo -- --reset
```

The same account also owns `po-bot`, a second Void-enabled organization left
empty for the Po Bot sample app.

The dashboard's Void pages default to frontend fixtures; switch to live data from
the last item of the version dropdown.

For SDK login, open another terminal from the repo root:

```bash
cd clients
source ../server/.env.void
pnpm --filter @void/sdk void login
```

Refresh the 24-hour SDK token with `cd server && uv run task void_seed --output .env.void`, then source the file again.

| Service | Port |
| --- | --- |
| Dashboard | 3000 |
| API | 8000 |
| Temporal | 7233 |
| Temporal UI | 8233 |
| Shared Tinybird | 7181 |

Run `dev stop` to stop all five tmux services. Run `dev down` to stop Docker
services; decline volume removal to keep data. To recreate an existing tmux
session, run `dev stop` then `dev start`.

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

### Visual Regression Testing

```bash
dev snap                            # Interactive: pick branch and URLs to test
dev snap --branch my-feature        # Test a specific branch
dev snap --url /dashboard/settings  # Test specific URL(s)
dev snap --detect                   # Auto-detect URLs from git diff
dev snap --viewport desktop,mobile  # Test multiple viewports
dev snap --interactive              # Show browser (headed mode)
```

Captures before/after screenshots across branches and generates a visual diff report.

## Docker dev environment

One shared infra stack (postgres, redis, minio, tinybird) plus one app stack (api, worker, web) per worktree, each on its own DB / Redis index / buckets. Service-aware commands auto-route by service name (`api`/`worker`/`web` → this instance, `db`/`redis`/`minio`/`tinybird` → shared). `dev docker --help` for the full list.

```bash
dev docker up                           # shared infra (if needed) + this instance's app stack
dev docker logs api                     # follow logs (auto-routes to the right project)
dev docker exec db psql -U polar -l     # one-off command in any container
dev docker down                         # stop this instance (--all to also stop shared)
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
    # ctx.database_name - if --database-name was passed
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
