"""Seed the database with sample data for development."""

import typer
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from shared import (
    ROOT_DIR,
    SECRETS_FILE,
    SERVER_DIR,
    console,
    run_command,
    step_spinner,
    step_status,
)


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


def _print_command_output(result: object) -> None:
    stdout = getattr(result, "stdout", "") or ""
    stderr = getattr(result, "stderr", "") or ""

    if stdout.strip():
        console.print(stdout.strip())
    if stderr.strip():
        console.print(stderr.strip())


def _print_info(message: str) -> None:
    console.print(f"[dim]{message}[/dim]")


def _confirm(message: str, *, default: bool = False) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    console.print(Text(f"{message} {suffix}:"), end=" ")
    response = input().strip().lower()
    if not response:
        return default
    return response in {"y", "yes"}


def _print_seeded_login_info(new_org: str | None = None) -> None:
    login_info = Table(show_header=False, box=None, padding=(0, 2))
    login_info.add_column(style="dim")
    login_info.add_column(style="bold")
    login_info.add_row("Email", f"{new_org}@polar.sh" if new_org else "admin@polar.sh")
    login_info.add_row("OTP", "Check the terminal running dev api")
    if not new_org:
        login_info.add_row("Note", "This account has access to multiple seeded organizations")

    console.print()
    console.print(
        Panel(
            login_info,
            title="[bold green]Organization Seeded![/bold green]" if new_org else "[bold green]Default Seed Loaded![/bold green]",
            subtitle="[dim]Log in with[/dim]" if new_org else "[dim]Use this account to access the seeded organizations[/dim]",
            border_style="green",
            padding=(1, 2),
        )
    )
    console.print()


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def seed(
        new_org: str | None = typer.Option(
            None,
            "--new-org",
            help="Create a single new organization with this slug, with products, customers, and timeline events.",
        ),
        reset: bool = typer.Option(
            False,
            "--reset",
            help="Recreate the database before loading fresh seed data.",
        ),
    ) -> None:
        """Load sample data (users, organizations, products) into the database."""
        console.print()

        if reset and new_org:
            console.print(
                "\n[red]--reset cannot be combined with --new-org.[/red]\n"
            )
            raise typer.Exit(1)

        if reset:
            console.print("[bold blue]Recreating database and loading fresh seeds...[/bold blue]\n")

            console.print("[yellow]This will delete all local database data before reseeding.[/yellow]")
            if not _confirm("Continue?"):
                raise typer.Abort()
            console.print()

            with step_spinner("Recreating database..."):
                result = run_command(
                    ["uv", "run", "task", "db_recreate"],
                    cwd=SERVER_DIR,
                    capture=True,
                )
            if not result or result.returncode != 0:
                _print_command_output(result)
                console.print("\n[red]Database recreate failed.[/red]\n")
                raise typer.Exit(1)
            step_status(True, "Database recreated")

            _print_info("Loading fresh seed data. This usually takes a few minutes.")
            with step_spinner("Seeding database..."):
                result = run_command(
                    ["uv", "run", "task", "seeds_load"],
                    cwd=SERVER_DIR,
                    capture=True,
                )
            if not result or result.returncode != 0:
                _print_command_output(result)
                console.print("\n[red]Seeding failed after database recreate.[/red]\n")
                raise typer.Exit(1)
            step_status(True, "Seed data loaded")

            _configure_polar_self_integration()
            _print_seeded_login_info()
            return

        if new_org:
            console.print(f"[bold blue]Creating organization '{new_org}'...[/bold blue]")
            _print_info("With products, customers, and timeline events.")
            console.print()

            cmd = ["uv", "run", "task", "seeds_load", f"--new-org={new_org}"]
        else:
            console.print("[bold blue]Seeding database...[/bold blue]")
            _print_info("Creating sample organizations, products, customers, and subscriptions.")
            console.print()

            cmd = ["uv", "run", "task", "seeds_load"]

        _print_info("This usually takes a few minutes.")
        with step_spinner("Seeding database..."):
            result = run_command(cmd, cwd=SERVER_DIR, capture=True)

        if result and result.returncode == 2:
            console.print()
            console.print(Panel(
                "[dim]Use [bold]dev seed --new-org <slug>[/bold] to create additional organizations.[/dim]\n[dim]Use [bold]dev seed --reset[/bold] to recreate the database and load fresh seeds.[/dim]",
                title="[bold yellow]Already seeded[/bold yellow]",
                border_style="yellow",
                padding=(1, 2),
            ))
            console.print()
            return

        if result and result.returncode == 0:
            step_status(True, "Seed data loaded")
            if not new_org:
                _configure_polar_self_integration()

            _print_seeded_login_info(new_org)
        else:
            _print_command_output(result)
            console.print("\n[red]Seeding failed.[/red]")
            console.print(
                "[dim]If the database already contains old seed data, run [bold]dev seed --reset[/bold] to recreate the database and load fresh seeds.[/dim]"
            )
            console.print(
                "[dim]Otherwise, make sure infrastructure is running (dev up) and migrations are applied.[/dim]\n"
            )
            raise typer.Exit(1)
