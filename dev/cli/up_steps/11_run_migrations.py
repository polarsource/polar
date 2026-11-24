"""Run database migrations."""

from pathlib import Path

from migration_drift import Drift, find_drift, unknown_revision
from shared import (
    ROOT_DIR,
    SERVER_DIR,
    Context,
    console,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Running database migrations"

KNOWN_FAILURES = (
    ("Multiple head revisions", "multiple_heads"),
    ("Connection refused", "database_unreachable"),
    ("Connect call failed", "database_unreachable"),
)

GENERIC_HINTS = (
    "Is PostgreSQL up? [bold]dev status[/bold] shows it; [bold]docker compose logs db[/bold] in server/ shows why not",
    "Run [bold]uv run task db_migrate[/bold] in server/ to retry with the full log",
    "A stale local database can be rebuilt with [bold]dev db reset[/bold] (this wipes local data)",
)


def current_branch() -> str:
    result = run_command(["git", "branch", "--show-current"], cwd=ROOT_DIR, capture=True)
    return (result.stdout.strip() if result else "") or "this checkout"


def print_option(number: int, title: str, detail: str, commands: tuple[str, ...]) -> None:
    console.print(f"\n    [bold cyan]Option {number}[/bold cyan]  [bold]{title}[/bold]")
    console.print(f"    [dim]{detail}[/dim]")
    for command in commands:
        console.print(f"      [green]$[/green] {command}")


def report_drift(drift: Drift) -> None:
    here = current_branch()
    step_status(False, "Database migrations", "the database is ahead of this branch")
    console.print(
        f"\n    Your database has migrations from [bold]{drift.branch}[/bold] that [bold]{here}[/bold] doesn't have:"
    )
    for revision, path in drift.paths.items():
        console.print(f"      [bold]{revision}[/bold]  [dim]{Path(path).name}[/dim]")
    print_option(
        1,
        f"Use {here}",
        "Rolls those migrations back. The rest of your local data is kept.",
        (f"dev db rollback {drift.revision}", "dev up"),
    )
    print_option(
        2,
        "Keep the migrations",
        f"Leaves the database as it is. You work on {drift.branch} instead.",
        (f"git switch {drift.branch}", "dev up"),
    )
    console.print()


def run(ctx: Context) -> bool:
    """Apply database migrations."""
    with step_spinner("Applying migrations..."):
        result = run_command(
            ["uv", "run", "task", "db_migrate"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Database migrations", "applied")
            return True

        revision = unknown_revision(result)
        drift = find_drift(revision) if revision else None
        if drift:
            ctx.failure_reason = "revision_from_other_branch"
        if drift and drift.target:
            report_drift(drift)
        elif drift:
            step_failed(
                "Database migrations",
                "the database is ahead of this branch",
                result,
                hints=(
                    f"Your database has a migration ([bold]{drift.revision}[/bold]) from another branch, and it can't be rolled back automatically",
                    "If that branch isn't fetched: [bold]git fetch[/bold], then [bold]dev up[/bold] again",
                    "Otherwise rebuild the database with [bold]dev db reset[/bold] (this wipes local data)",
                ),
                lines=1,
            )
        else:
            output = f"{result.stdout}\n{result.stderr}" if result else ""
            ctx.failure_reason = next(
                (reason for marker, reason in KNOWN_FAILURES if marker in output), None
            )
            step_failed(
                "Database migrations", "failed", result, hints=GENERIC_HINTS, lines=40
            )
        return False
