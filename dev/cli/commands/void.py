"""Run Void's local infrastructure and dedicated Temporal worker."""

import os

import typer

from shared import SERVER_DIR, console
from void_local import ENV_FILE, environment, ports, start_infrastructure


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def void() -> None:
        """Start Void's Temporal, Tinybird, and worker. Run dev api separately."""
        if not ENV_FILE.exists():
            console.print("[red]Run dev up --void first.[/red]")
            raise typer.Exit(1)
        if not start_infrastructure():
            raise typer.Exit(1)
        os.environ.update(environment())
        os.chdir(SERVER_DIR)
        console.print(
            f"[bold blue]Starting Void worker. Temporal UI: http://localhost:{ports()['POLAR_VOID_TEMPORAL_UI_PORT']}[/bold blue]"
        )
        os.execvp("uv", ["uv", "run", "task", "void_worker"])
