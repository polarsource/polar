"""Start the background job worker."""

import os

import typer

from shared import SERVER_DIR, console


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def worker() -> None:
        """Start the background job worker."""
        if not prompt_setup():
            raise typer.Exit(1)

        console.print("\n[bold blue]Starting background worker[/bold blue]\n")

        os.chdir(SERVER_DIR)
        cmd = [
            "uv", "run", "dramatiq",
            "-p", "1", "-t", "1",
            "--queues", "high_priority", "medium_priority", "low_priority",
            "--watch", "polar",
            "-f", "polar.worker.scheduler:start",
            "polar.worker.run",
        ]

        os.execvp(cmd[0], cmd)
