#!/usr/bin/env -S uv run -s
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "typer>=0.12.0",
#     "rich>=13.0.0",
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Polar Development CLI

A CLI tool to streamline Polar development environment setup and management.
"""

import importlib.util
import sys
import time
from pathlib import Path
from typing import Annotated

import typer

CLI_DIR = Path(__file__).parent
sys.path.insert(0, str(CLI_DIR))

from rich.padding import Padding
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from shared import (
    CLIENTS_DIR,
    SERVER_DIR,
    Context,
    check_env_file_exists,
    check_node_modules_exists,
    check_venv_exists,
    console,
    run_command,
)

app = typer.Typer(
    name="dev",
    help="Polar Development CLI - streamline your dev environment",
    no_args_is_help=True,
)


def get_docker_compose_status() -> dict[str, bool]:
    """Get status of docker compose services."""
    result = run_command(
        ["docker", "compose", "ps", "--format", "{{.Name}} {{.State}}"],
        cwd=SERVER_DIR,
        capture=True,
    )
    status = {}
    if result and result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line:
                parts = line.split()
                if len(parts) >= 2:
                    name = parts[0]
                    state = parts[1].lower()
                    status[name] = state == "running"
    return status


def is_environment_ready() -> tuple[bool, list[str]]:
    """Check if the environment is ready for running services."""
    issues = []

    status = get_docker_compose_status()
    if not status:
        issues.append("Docker containers not running")
    else:
        required = ["db", "redis", "minio"]
        for service in required:
            found = any(service in name and running for name, running in status.items())
            if not found:
                issues.append(f"{service} container not running")

    if not check_env_file_exists(SERVER_DIR / ".env"):
        issues.append("server/.env not found")
    if not check_env_file_exists(CLIENTS_DIR / "apps" / "web" / ".env.local"):
        issues.append("clients/apps/web/.env.local not found")

    if not check_venv_exists():
        issues.append("Python virtual environment not found")
    if not check_node_modules_exists():
        issues.append("node_modules not found")

    return len(issues) == 0, issues


def prompt_setup_if_needed() -> bool:
    """Prompt user to run setup if environment is not ready."""
    ready, issues = is_environment_ready()
    if ready:
        return True

    console.print("[yellow]Environment not ready:[/yellow]")
    for issue in issues:
        console.print(f"  [dim]- {issue}[/dim]")

    if typer.confirm("\nRun `dev up` now?"):
        up(clean=False, skip_integrations=False)
        return True
    return False


def discover_steps() -> list[tuple[str, any]]:
    """Discover and load step modules from the up_steps directory."""
    steps_dir = CLI_DIR / "up_steps"
    step_files = sorted(steps_dir.glob("[0-9][0-9]_*.py"))

    steps = []
    for step_file in step_files:
        spec = importlib.util.spec_from_file_location(step_file.stem, step_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        steps.append((getattr(module, "NAME", step_file.stem), module))

    return steps


def register_commands() -> None:
    """Register commands from the commands directory."""
    commands_dir = CLI_DIR / "commands"
    for cmd_file in commands_dir.glob("*.py"):
        if cmd_file.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(cmd_file.stem, cmd_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "register"):
            module.register(app, prompt_setup_if_needed)


@app.command()
def up(
    clean: Annotated[
        bool, typer.Option("--clean", help="Force re-run all steps")
    ] = False,
    skip_integrations: Annotated[
        bool, typer.Option("--skip-integrations", help="Skip GitHub/Stripe setup prompts")
    ] = False,
) -> None:
    """
    Prepare the development environment.

    Installs dependencies, starts infrastructure, runs migrations,
    and prompts to configure GitHub and Stripe integrations.
    """
    console.print()
    console.print(Panel(
        Text("Setting up Polar development environment", justify="center", style="bold"),
        border_style="blue",
        padding=(1, 4),
    ))
    console.print()

    ctx = Context(clean=clean, skip_integrations=skip_integrations)
    steps = discover_steps()
    total = len(steps)
    start_time = time.time()

    for i, (name, module) in enumerate(steps, 1):
        console.print(f"[bold blue][{i}/{total}][/bold blue] [bold]{name}[/bold]")
        if not module.run(ctx):
            console.print(f"\n[red]Setup failed at step {i}/{total}: {name}[/red]")
            raise typer.Exit(1)
        console.print()

    elapsed = time.time() - start_time
    minutes, seconds = divmod(int(elapsed), 60)
    time_str = f"{minutes}m {seconds}s" if minutes else f"{seconds}s"

    next_steps = Table(show_header=False, box=None, padding=(0, 2))
    next_steps.add_column(style="bold cyan")
    next_steps.add_column(style="dim")
    next_steps.add_row("[dim]Recommended", "")
    next_steps.add_row("dev seed", "Load sample data")
    next_steps.add_row()
    next_steps.add_row("[dim]Start all services", "")
    next_steps.add_row("dev start", "API, worker, web, and Stripe in a tmux session")
    next_steps.add_row()
    next_steps.add_row("[dim]Start specific services", "")
    next_steps.add_row("dev api", "API server")
    next_steps.add_row("dev worker", "Background worker")
    next_steps.add_row("dev web", "Frontend dev server")
    next_steps.add_row("dev stripe", "Stripe webhook listener")
    next_steps.add_row()
    next_steps.add_row("[dim]Need assistance?", "")
    next_steps.add_row("dev help", "Show all available commands")

    console.print(Panel(
        Padding(next_steps, (1, 2)),
        title="[bold green]Ready![/bold green]",
        subtitle=f"[dim]completed in {time_str}[/dim]",
        border_style="green",
        padding=(0, 0),
    ))
    console.print()


@app.command()
def help() -> None:
    """Show all available commands."""
    console.print()
    console.print(Panel(
        Text("Polar Development CLI", justify="center", style="bold"),
        border_style="blue",
        padding=(1, 4),
    ))

    def _section(title: str, commands: list[tuple[str, str]]) -> None:
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column(style="bold cyan", min_width=16)
        table.add_column(style="dim")
        for cmd, desc in commands:
            table.add_row(cmd, desc)
        console.print(f"\n  [bold]{title}[/bold]")
        console.print(Padding(table, (0, 2)))

    _section("Setup & Environment", [
        ("up", "Prepare the development environment"),
        ("down", "Stop infrastructure"),
        ("reset", "Reset environment to clean state"),
        ("status", "Show environment status"),
        ("logs", "View Docker container logs"),
    ])

    _section("Run Services", [
        ("start", "Start all services in a tmux session"),
        ("api", "Start the backend API server"),
        ("worker", "Start the background job worker"),
        ("web", "Start the frontend dev server"),
        ("stripe", "Start Stripe webhook listener"),
    ])

    _section("Database", [
        ("seed", "Load sample data into the database"),
        ("db migrate", "Run database migrations"),
        ("db reset", "Reset database"),
    ])

    _section("Docker (Isolated)", [
        ("docker up", "Start full stack in Docker containers"),
        ("docker down", "Stop Docker services"),
        ("docker logs", "View Docker service logs"),
        ("docker ps", "List running Docker services"),
        ("docker shell", "Open shell in a Docker container"),
        ("docker cleanup", "Remove containers and volumes"),
    ])

    console.print()


register_commands()


if __name__ == "__main__":
    app()
