"""Run database migrations."""

from shared import (
    SERVER_DIR,
    Context,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Running database migrations"


def run(ctx: Context) -> bool:
    """Apply database migrations."""
    with step_spinner("Applying migrations..."):
        result = run_command(
            ["uv", "run", "task", "db_migrate"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Database migrations", "applied")
            return True
        else:
            step_failed(
                "Database migrations",
                "failed",
                result,
                hints=(
                    "Is PostgreSQL up? [bold]dev status[/bold] shows it; [bold]docker compose logs db[/bold] in server/ shows why not",
                    "Run [bold]uv run task db_migrate[/bold] in server/ to retry with the full log",
                    "A stale local database can be rebuilt with [bold]dev db reset[/bold] (this wipes local data)",
                ),
                lines=40,
            )
            return False
