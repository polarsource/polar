"""Start the backend API server."""

import os
from typing import Annotated, Optional

import typer

from shared import (
    DEFAULT_API_PORT,
    SERVER_DIR,
    console,
    find_available_port,
    is_port_in_use,
)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def api(
        port: Annotated[
            Optional[int], typer.Option("--port", "-p", help="Port to run on")
        ] = None,
    ) -> None:
        """Start the backend API server."""
        if not prompt_setup():
            raise typer.Exit(1)

        target_port = port or DEFAULT_API_PORT
        if is_port_in_use(target_port):
            if port:
                console.print(f"[red]Port {target_port} is already in use[/red]")
                raise typer.Exit(1)
            else:
                new_port = find_available_port(target_port)
                console.print(f"[yellow]Port {target_port} in use, using {new_port} instead[/yellow]")
                target_port = new_port

        console.print(f"\n[bold blue]Starting API server on port {target_port}[/bold blue]\n")

        os.chdir(SERVER_DIR)
        cmd = [
            "uv", "run", "uvicorn", "polar.app:app",
            "--reload", "--workers", "1",
            "--host", "127.0.0.1", "--port", str(target_port),
        ]

        os.environ["AUTHLIB_INSECURE_TRANSPORT"] = "true"
        os.execvp(cmd[0], cmd)
