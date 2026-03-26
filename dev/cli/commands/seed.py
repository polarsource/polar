"""Seed the database with sample data for development."""

import typer
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from shared import SERVER_DIR, console, run_command


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def seed() -> None:
        """Load sample data (users, organizations, products) into the database."""
        console.print()
        console.print("[bold blue]Seeding database...[/bold blue]")
        console.print("[dim]Creating sample organizations, products, customers, and subscriptions.[/dim]\n")

        result = run_command(
            ["uv", "run", "task", "seeds_load"],
            cwd=SERVER_DIR,
            capture=False,
        )

        if result and result.returncode == 0:
            login_info = Table(show_header=False, box=None, padding=(0, 2))
            login_info.add_column(style="dim")
            login_info.add_column(style="bold")
            login_info.add_row("Email", "admin@polar.sh")
            login_info.add_row("OTP", "Check the terminal running dev api")

            console.print()
            console.print(Panel(
                login_info,
                title="[bold green]Seeded![/bold green]",
                subtitle="[dim]Log in with[/dim]",
                border_style="green",
                padding=(1, 2),
            ))
            console.print()
        else:
            console.print("\n[red]Seeding failed.[/red]")
            console.print("[dim]Make sure infrastructure is running (dev up) and migrations are applied.[/dim]\n")
            raise typer.Exit(1)
