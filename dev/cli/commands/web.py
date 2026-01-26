"""Start the frontend web dev server."""

import os
from typing import Annotated, Optional

import typer

from shared import (
    CLIENTS_DIR,
    DEFAULT_WEB_PORT,
    console,
    find_available_port,
    is_port_in_use,
)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def web(
        port: Annotated[
            Optional[int], typer.Option("--port", "-p", help="Port to run on")
        ] = None,
    ) -> None:
        """Start the frontend web dev server."""
        if not prompt_setup():
            raise typer.Exit(1)

        target_port = port or DEFAULT_WEB_PORT
        if is_port_in_use(target_port):
            if port:
                console.print(f"[red]Port {target_port} is already in use[/red]")
                raise typer.Exit(1)
            else:
                new_port = find_available_port(target_port)
                console.print(f"[yellow]Port {target_port} in use, using {new_port} instead[/yellow]")
                target_port = new_port

        console.print(f"\n[bold blue]Starting web frontend on port {target_port}[/bold blue]\n")

        web_app_dir = CLIENTS_DIR / "apps" / "web"
        os.chdir(web_app_dir)

        cmd = ["pnpm", "next", "dev", "--port", str(target_port), "--turbopack"]
        os.execvp(cmd[0], cmd)
