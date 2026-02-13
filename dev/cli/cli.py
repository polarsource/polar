#!/usr/bin/env -S uv run -s
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "typer>=0.12.0",
#     "rich>=13.0.0",
# ]
# ///
"""
Polar Development CLI

A CLI tool to streamline Polar development environment setup and management.
"""

import importlib.util
import sys
from pathlib import Path
from typing import Annotated

import typer

CLI_DIR = Path(__file__).parent
sys.path.insert(0, str(CLI_DIR))

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
    console.print("\n[bold blue]Setting up Polar development environment[/bold blue]\n")

    ctx = Context(clean=clean, skip_integrations=skip_integrations)
    steps = discover_steps()

    for name, module in steps:
        console.print(f"[bold]{name}...[/bold]")
        if not module.run(ctx):
            console.print(f"\n[red]Setup failed at: {name}[/red]")
            raise typer.Exit(1)
        console.print()

    console.print("[bold green]Environment ready![/bold green]")
    console.print("\nNext steps:")
    console.print("  [dim]dev api[/dim]     - Start API server")
    console.print("  [dim]dev worker[/dim]  - Start background worker")
    console.print("  [dim]dev web[/dim]     - Start web frontend")
    console.print()


@app.command()
def help() -> None:
    """Show all available commands."""
    console.print("\n[bold blue]Polar Development CLI[/bold blue]\n")
    console.print("Usage: [bold]dev <command>[/bold]\n")

    console.print("[bold]Setup & Environment:[/bold]")
    console.print("  [bold]up[/bold]            Prepare the development environment")
    console.print("  [bold]down[/bold]          Stop infrastructure")
    console.print("  [bold]reset[/bold]         Reset environment to clean state")
    console.print("  [bold]status[/bold]        Show environment status")
    console.print("  [bold]logs[/bold]          View Docker container logs")

    console.print("\n[bold]Run Services:[/bold]")
    console.print("  [bold]api[/bold]           Start the backend API server")
    console.print("  [bold]worker[/bold]        Start the background job worker")
    console.print("  [bold]web[/bold]           Start the frontend dev server")

    console.print("\n[bold]Database:[/bold]")
    console.print("  [bold]db migrate[/bold]    Run database migrations")
    console.print("  [bold]db reset[/bold]      Reset database")

    console.print("\n[bold]Docker (Isolated):[/bold]")
    console.print("  [bold]docker up[/bold]      Start full stack in Docker containers")
    console.print("  [bold]docker down[/bold]    Stop Docker services")
    console.print("  [bold]docker logs[/bold]    View Docker service logs")
    console.print("  [bold]docker ps[/bold]      List running Docker services")
    console.print("  [bold]docker shell[/bold]   Open shell in a Docker container")
    console.print("  [bold]docker cleanup[/bold] Remove containers and volumes")
    console.print()


register_commands()


if __name__ == "__main__":
    app()
