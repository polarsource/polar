"""Lock and unlock deploys to main."""

import subprocess

import typer

from shared import console


def _check_gh_auth() -> None:
    try:
        result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        console.print(
            "[red]gh CLI not found.[/red] Install it from https://cli.github.com/"
        )
        raise typer.Exit(1)

    if result.returncode != 0:
        console.print("[red]Not logged in to GitHub.[/red] Run [bold]gh auth login[/bold] first.")
        raise typer.Exit(1)


def _run_gh_workflow(workflow: str, *args: str) -> None:
    _check_gh_auth()
    result = subprocess.run(
        ["gh", "workflow", "run", workflow, *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        console.print(f"[red]Failed to trigger {workflow}:[/red]")
        if result.stderr:
            console.print(result.stderr.strip())
        raise typer.Exit(1)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command("lock-deploys")
    def lock_deploys(
        reason: str = typer.Argument(..., help="Why deploys are being locked"),
    ) -> None:
        """Lock deploys to main. Blocks all merges until unlocked.

        Triggers a workflow that activates a GitHub ruleset, preventing
        pushes and merges to main for everyone except the emergency-merge
        identity. Comment /emergency on a PR to bypass the lock.
        """
        _run_gh_workflow("deploy-lock.yml", "-f", f"reason={reason}")
        console.print("[bold]Deploy lock requested.[/bold]")
        console.print(
            "[dim]Check Slack for confirmation that the lock is active.[/dim]"
        )

    @app.command("unlock-deploys")
    def unlock_deploys() -> None:
        """Unlock deploys to main."""
        _run_gh_workflow("deploy-unlock.yml")
        console.print("[bold]Deploy unlock requested.[/bold]")
        console.print(
            "[dim]Check Slack for confirmation that deploys are unlocked.[/dim]"
        )
