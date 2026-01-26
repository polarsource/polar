"""Database management commands."""

from typing import Annotated

import typer

from shared import SERVER_DIR, console, run_command


def register(app: typer.Typer, prompt_setup: callable) -> None:
    db_app = typer.Typer(help="Database management commands")
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

    @db_app.command("reset")
    def db_reset(
        force: Annotated[
            bool, typer.Option("--force", "-f", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Reset database to clean state."""
        if not force:
            console.print("[yellow]This will delete all data in the database.[/yellow]")
            if not typer.confirm("Continue?"):
                raise typer.Abort()

        console.print("\n[bold blue]Resetting database[/bold blue]\n")

        result = run_command(["uv", "run", "task", "db_recreate"], cwd=SERVER_DIR, capture=False)
        if result and result.returncode == 0:
            console.print("\n[green]✓[/green] Database reset complete")
        else:
            console.print("\n[red]✗[/red] Database reset failed")
            raise typer.Exit(1)
