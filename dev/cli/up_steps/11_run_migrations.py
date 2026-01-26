"""Run database migrations."""

from shared import (
    Context,
    SERVER_DIR,
    console,
    run_command,
    step_status,
)

NAME = "Running database migrations"


def run(ctx: Context) -> bool:
    """Apply database migrations."""
    with console.status("[bold]Applying migrations...[/bold]"):
        result = run_command(
            ["uv", "run", "task", "db_migrate"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Database migrations", "applied")
            return True
        else:
            step_status(False, "Database migrations", "failed")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            return False
