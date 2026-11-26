"""Database management commands."""

from pathlib import Path
from typing import Annotated

import typer

from migration_drift import find_drift, roll_back
from shared import SERVER_DIR, CommandGroup, console, run_command


def register(app: typer.Typer, prompt_setup: callable) -> None:
    db_app = typer.Typer(cls=CommandGroup, help="Database management commands")
    app.add_typer(db_app, name="db")

    @db_app.command("migrate")
    def db_migrate() -> None:
        """Run database migrations."""
        console.print("\n[bold blue]Running database migrations[/bold blue]\n")

        result = run_command(["uv", "run", "task", "db_migrate"], cwd=SERVER_DIR, capture=False)
        if result and result.returncode == 0:
            console.print("\n[green]✓[/green] Migrations applied")
        else:
            console.print("\n[red]✗[/red] Migration failed")
            raise typer.Exit(1)

    @db_app.command("rollback")
    def db_rollback(
        revision: Annotated[
            str, typer.Argument(help="Revision ID of the migration to roll back")
        ],
        force: Annotated[
            bool, typer.Option("--force", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Roll back a migration and everything applied after it, even one that only exists on another branch."""
        drift = find_drift(revision)
        if drift.target is None:
            console.print(
                f"[red]✗[/red] Migration [bold]{revision}[/bold] isn't in this checkout and can't be traced back from a local or fetched branch"
            )
            console.print("  If its branch isn't fetched, run [bold]git fetch[/bold] and try again")
            raise typer.Exit(1)

        if drift.paths:
            console.print(f"\nMigrations from [bold]{drift.branch}[/bold] to roll back:")
            for migration, path in drift.paths.items():
                console.print(f"  [bold]{migration}[/bold]  [dim]{Path(path).name}[/dim]")
        else:
            console.print(f"\nRolling back migration [bold]{revision}[/bold] and everything applied after it.")
        console.print("[yellow]This deletes the data in what they added. The rest of the database is kept.[/yellow]")
        if not force and not typer.confirm("Continue?"):
            raise typer.Abort()

        if not roll_back(drift):
            console.print("\n[red]✗[/red] Rollback failed")
            raise typer.Exit(1)
        console.print("\n[green]✓[/green] Rolled back. Run [bold]dev up[/bold] to continue")

    @db_app.command("reset")
    def db_reset(
        force: Annotated[
            bool, typer.Option("--force", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Reset database to clean state."""
        if not force:
            console.print("[yellow]This will delete all data in the database.[/yellow]")
            if not typer.confirm("Continue?"):
                raise typer.Abort()

        console.print("\n[bold blue]Resetting database[/bold blue]\n")

        result = run_command(["uv", "run", "task", "db_recreate"], cwd=SERVER_DIR, capture=False)
        if not result or result.returncode != 0:
            console.print("\n[red]✗[/red] Database reset failed")
            raise typer.Exit(1)
        console.print("[green]✓[/green] Database reset")

        result = run_command(
            ["docker", "compose", "exec", "redis", "redis-cli", "FLUSHALL"],
            cwd=SERVER_DIR,
            capture=True,
        )
        if result and result.returncode == 0:
            console.print("[green]✓[/green] Redis flushed")
        else:
            console.print("[yellow]⚠[/yellow] Could not flush Redis")
