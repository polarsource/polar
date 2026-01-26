"""View Docker container logs."""

import os
from typing import Annotated, Optional

import typer

from shared import SERVER_DIR, console


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def logs(
        service: Annotated[
            Optional[str], typer.Argument(help="Service name (db, redis, minio, tinybird)")
        ] = None,
        follow: Annotated[
            bool, typer.Option("--follow", "-f", help="Follow log output")
        ] = True,
        tail: Annotated[
            int, typer.Option("--tail", "-n", help="Number of lines to show")
        ] = 100,
    ) -> None:
        """View Docker container logs."""
        cmd = ["docker", "compose", "logs"]

        if follow:
            cmd.append("-f")

        cmd.extend(["--tail", str(tail)])

        if service:
            cmd.append(service)

        console.print(f"[dim]Showing logs{' for ' + service if service else ''}...[/dim]\n")

        os.chdir(SERVER_DIR)
        os.execvp(cmd[0], cmd)
