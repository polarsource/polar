"""Stop the running dev services (the tmux session started by `dev start`)."""

import typer

from shared import console, run_command

SESSION = "polar"


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def stop() -> None:
        """Stop all dev services by killing the `dev start` tmux session."""
        has_session = run_command(
            ["tmux", "has-session", "-t", SESSION], capture=True
        )
        if not has_session or has_session.returncode != 0:
            console.print(f"[dim]No '{SESSION}' session running[/dim]")
            return

        result = run_command(["tmux", "kill-session", "-t", SESSION], capture=True)
        if result and result.returncode == 0:
            console.print(f"[green]✓[/green] Stopped '{SESSION}' session")
        else:
            console.print(f"[red]✗[/red] Failed to stop '{SESSION}' session")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            raise typer.Exit(1)
