"""Seed the database with sample data for development."""

import typer
from rich.panel import Panel
from rich.table import Table

from shared import ROOT_DIR, SECRETS_FILE, SERVER_DIR, console, run_command


def _update_secrets_file(key: str, value: str) -> None:
    """Update a key in the central secrets file."""
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                existing[k.strip()] = v.strip().strip("\"'")

    existing[key] = value

    with open(SECRETS_FILE, "w") as f:
        f.write("# Polar Development Secrets\n")
        f.write("# Shared across Git worktrees\n\n")
        for k, v in existing.items():
            delimiter = "'" if '"' in v else '"'
            f.write(f"{k}={delimiter}{v}{delimiter}\n")


def _configure_polar_self_integration() -> None:
    """Query the seeded admin org and configure Polar self-integration env vars."""
    result = run_command(
        ["uv", "run", "python", "-m", "scripts.seeds_load", "polar-self-env"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if not result or result.returncode != 0:
        return

    for line in result.stdout.strip().split("\n"):
        if "=" in line:
            key, value = line.split("=", 1)
            _update_secrets_file(key.strip(), value.strip())

    run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
    console.print("[dim]Configured Polar self-integration in .env[/dim]")


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def seed(
        new_org: str | None = typer.Option(
            None,
            "--new-org",
            help="Create a single new organization with this slug, with products, customers, and timeline events.",
        ),
    ) -> None:
        """Load sample data (users, organizations, products) into the database."""
        console.print()

        if new_org:
            console.print(f"[bold blue]Creating organization '{new_org}'...[/bold blue]")
            console.print("[dim]With products, customers, and timeline events.[/dim]\n")

            cmd = ["uv", "run", "task", "seeds_load", f"--new-org={new_org}"]
        else:
            console.print("[bold blue]Seeding database...[/bold blue]")
            console.print("[dim]Creating sample organizations, products, customers, and subscriptions.[/dim]\n")

            cmd = ["uv", "run", "task", "seeds_load"]

        result = run_command(cmd, cwd=SERVER_DIR, capture=False)

        if result and result.returncode == 2:
            console.print()
            console.print(Panel(
                "[dim]Use [bold]dev seed --new-org <slug>[/bold] to create additional organizations.[/dim]",
                title="[bold yellow]Already seeded[/bold yellow]",
                border_style="yellow",
                padding=(1, 2),
            ))
            console.print()
            return

        if result and result.returncode == 0:
            if not new_org:
                _configure_polar_self_integration()

            login_info = Table(show_header=False, box=None, padding=(0, 2))
            login_info.add_column(style="dim")
            login_info.add_column(style="bold")
            login_info.add_row("Email", f"{new_org}@polar.sh" if new_org else "admin@polar.sh")
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
