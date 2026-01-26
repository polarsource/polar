"""Reset the development environment to a clean state."""

import shutil
from typing import Annotated

import typer

from shared import (
    CLIENTS_DIR,
    SERVER_DIR,
    console,
    run_command,
    step_status,
)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def reset(
        force: Annotated[
            bool, typer.Option("--force", "-f", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Reset environment to clean state for testing dev up."""
        console.print("\n[bold blue]Resetting Polar development environment[/bold blue]\n")

        if not force:
            console.print("[yellow]This will remove:[/yellow]")
            console.print("  • Docker containers and volumes")
            console.print("  • Python virtual environment (server/.venv)")
            console.print("  • Node modules (clients/node_modules)")
            console.print("  • Environment files (.env, .env.local)")
            console.print("  • Frontend build (clients/apps/web/.next)")
            console.print()
            if not typer.confirm("Continue?"):
                raise typer.Abort()

        console.print()

        # Stop Docker containers and remove volumes
        with console.status("[bold]Stopping Docker containers...[/bold]"):
            result = run_command(
                ["docker", "compose", "down", "-v"],
                cwd=SERVER_DIR,
                capture=True,
            )
        if result and result.returncode == 0:
            step_status(True, "Docker containers", "stopped and volumes removed")
        else:
            step_status(True, "Docker containers", "not running or Docker not installed")

        # Remove Python venv
        venv_path = SERVER_DIR / ".venv"
        if venv_path.exists():
            with console.status("[bold]Removing Python venv...[/bold]"):
                shutil.rmtree(venv_path)
            step_status(True, "Python venv", "removed")
        else:
            step_status(True, "Python venv", "not found")

        # Remove node_modules
        node_modules_path = CLIENTS_DIR / "node_modules"
        if node_modules_path.exists():
            with console.status("[bold]Removing node_modules...[/bold]"):
                shutil.rmtree(node_modules_path)
            step_status(True, "node_modules", "removed")
        else:
            step_status(True, "node_modules", "not found")

        # Remove .env files
        env_files = [
            SERVER_DIR / ".env",
            CLIENTS_DIR / "apps" / "web" / ".env.local",
        ]
        for env_file in env_files:
            if env_file.exists():
                env_file.unlink()
                step_status(True, str(env_file.relative_to(SERVER_DIR.parent)), "removed")
            else:
                step_status(True, str(env_file.relative_to(SERVER_DIR.parent)), "not found")

        # Remove .next build folder
        next_path = CLIENTS_DIR / "apps" / "web" / ".next"
        if next_path.exists():
            with console.status("[bold]Removing .next build...[/bold]"):
                shutil.rmtree(next_path)
            step_status(True, ".next build", "removed")
        else:
            step_status(True, ".next build", "not found")

        console.print("\n[bold green]Environment reset![/bold green]")
        console.print("\nRun [bold]dev up[/bold] to set up from scratch.")
        console.print()
