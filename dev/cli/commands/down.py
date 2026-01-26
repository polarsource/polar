"""Stop infrastructure and clean up."""

from typing import Annotated

import typer

from shared import SERVER_DIR, console, run_command


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def down(
        volumes: Annotated[
            bool, typer.Option("--volumes", "-v", help="Also remove volumes (data)")
        ] = False,
    ) -> None:
        """Stop infrastructure and clean up."""
        console.print("\n[bold blue]Stopping Polar development environment[/bold blue]\n")

        remove_volumes = volumes
        if not volumes:
            remove_volumes = typer.confirm("Also remove volumes (database data)?", default=False)

        cmd = ["docker", "compose", "down"]
        if remove_volumes:
            cmd.append("-v")
            console.print("[yellow]Removing containers and volumes...[/yellow]")
        else:
            console.print("[dim]Removing containers (keeping data)...[/dim]")

        result = run_command(cmd, cwd=SERVER_DIR, capture=True)
        if result and result.returncode == 0:
            console.print("\n[green]✓[/green] Environment stopped")
        else:
            console.print("\n[red]✗[/red] Failed to stop environment")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            raise typer.Exit(1)
